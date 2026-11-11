import crypto from 'node:crypto'

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [algorithm, salt, expected] = String(stored || '').split(':')
  if (algorithm !== 'scrypt' || !salt || !expected || !/^[a-f0-9]{128}$/i.test(expected)) return false
  const actual = crypto.scryptSync(String(password), salt, 64)
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'))
}
