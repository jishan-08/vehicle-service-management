import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import User from '../../backend/models/User.js'
import Vehicle from '../../backend/models/Vehicle.js'
import Service from '../../backend/models/Service.js'
import Appointment from '../../backend/models/Appointment.js'
import Bill from '../../backend/models/Bill.js'
import connectDB from '../../backend/config/db.js'

const require = createRequire(import.meta.url)
const mongoose = require('../../backend/node_modules/mongoose')
const bcrypt = require('../../backend/node_modules/bcryptjs')
const dotenv = require('../../backend/node_modules/dotenv')
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend/.env') })
dns.setServers(['8.8.8.8', '8.8.4.4'])

const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
const password = 'E2E-Password-123!'
const users = {
  customer: { name: 'E2E Customer', email: `e2e-customer-${runId}@example.com`, role: 'CUSTOMER' },
  staff: { name: 'E2E Staff', email: `e2e-staff-${runId}@example.com`, role: 'STAFF' },
  admin: { name: 'E2E Admin', email: `e2e-admin-${runId}@example.com`, role: 'ADMIN' },
}
let customerId

test.beforeAll(async () => {
  await connectDB()
  const passwordHash = await bcrypt.hash(password, 4)
  const created = Object.entries(users).map(([key, user]) => ({
    _id: new mongoose.Types.ObjectId(),
    ...user,
    username: `e2e-${key}-${runId}`,
    passwordHash,
  }))
  await User.collection.insertMany(created)
  customerId = created[0]._id
})

test.afterAll(async () => {
  const vehicles = await Vehicle.find({ owner: customerId }).select('_id')
  const services = await Service.find({ customer: customerId }).select('_id')
  const appointments = await Appointment.find({ customer: customerId }).select('_id')
  await Bill.deleteMany({ customer: customerId })
  await Appointment.deleteMany({ _id: { $in: appointments.map((item) => item._id) } })
  await Service.deleteMany({ _id: { $in: services.map((item) => item._id) } })
  await Vehicle.deleteMany({ _id: { $in: vehicles.map((item) => item._id) } })
  await User.deleteMany({ email: { $regex: `e2e-.*-${runId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@example\\.com$` } })
  await mongoose.disconnect()
})

async function login(page, user) {
  const apiLogin = await page.request.post('http://localhost:5000/api/auth/login', { data: { email: user.email, password } })
  expect(apiLogin.status(), `API login failed for ${user.role}`).toBe(200)
  await page.goto('/login')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByRole('textbox', { name: /Password/ }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('login, protected routes, and responsive login behavior', async ({ page }) => {
  const consoleErrors = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))

  await page.goto('/customer')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('textbox', { name: /Password/ }).fill(password)
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByRole('textbox', { name: /Password Hide password/ })).toHaveAttribute('type', 'text')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(consoleErrors).toEqual([])
})

test('customer completes vehicle, service, appointment, billing, profile, and logout journey', async ({ page }) => {
  await login(page, users.customer)
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()

  await page.getByRole('link', { name: 'Vehicles' }).click()
  await page.getByRole('button', { name: 'Add vehicle' }).click()
  await page.getByLabel('Registration number').fill(`E2E${runId.slice(-8)}`)
  await page.getByLabel('Make').fill('Toyota')
  await page.getByLabel('Model').fill('Corolla')
  await page.getByLabel('Year').fill('2023')
  await page.getByRole('button', { name: 'Add vehicle' }).last().click()
  await expect(page.getByText('Toyota Corolla')).toBeVisible()
  await page.getByRole('button', { name: /Edit E2E/ }).click()
  await page.getByLabel('Model').fill('Camry')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Toyota Camry')).toBeVisible()

  await page.getByRole('link', { name: 'Services' }).click()
  await page.getByRole('button', { name: 'Request service' }).click()
  await page.getByLabel('Description').fill('E2E service request')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByText('GENERAL SERVICE')).toBeVisible()

  await page.getByRole('link', { name: 'Appointments' }).click()
  await page.getByRole('button', { name: 'New appointment' }).click()
  await page.getByLabel('Date').fill('2099-12-01')
  await page.getByLabel('Time').fill('10:00')
  await page.getByRole('button', { name: 'Book appointment' }).click()
  await expect(page.getByText('2099-12-01')).toBeVisible()
  await page.getByText('2099-12-01').click()
  await page.getByRole('button', { name: /Cancel appointment/ }).click()
  await expect(page.getByText('CANCELLED')).toBeVisible()

  await page.getByRole('link', { name: 'Bills' }).click()
  await expect(page.getByRole('heading', { name: 'Bills', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('staff and admin role workspaces expose permitted pages without frontend role escalation', async ({ page }) => {
  await login(page, users.staff)
  await expect(page.getByRole('heading', { name: 'Ready for the day.' })).toBeVisible()
  const reportsLink = page
  .getByRole('navigation', { name: 'Main Navigation' })
  .getByRole('link', { name: 'Reports' })
  await expect(reportsLink).toBeVisible()
  await reportsLink.click()
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/staff$/)
  await page.getByRole('button', { name: 'Sign out' }).click()

  await login(page, users.admin)
  await expect(page.getByRole('heading', { name: 'The operation, at a glance.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Reports' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Bills' }).click()
  await expect(page.getByRole('heading', { name: 'Bills', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})