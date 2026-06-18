/**
 * OSS 单对象存储，等价于 Cloudflare KV 的 stats:bundle
 */

const OSS = require('ali-oss')
const { emptyBundle, normalizeBundle } = require('./stats-core')

const OBJECT_KEY = 'stats/bundle.json'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`缺少环境变量 ${name}`)
  return value
}

function ossRegion() {
  const raw = requireEnv('OSS_REGION')
  return raw.startsWith('oss-') ? raw : `oss-${raw}`
}

/** @param {{ credentials?: { accessKeyId?: string, accessKeySecret?: string, securityToken?: string } }} context */
function createStore(context) {
  const creds = context.credentials
  if (!creds?.accessKeyId) {
    throw new Error('FC 执行角色凭证不可用，请为函数配置 RAM 角色并授予 OSS 读写权限')
  }

  const client = new OSS({
    region: ossRegion(),
    bucket: requireEnv('OSS_BUCKET'),
    accessKeyId: creds.accessKeyId,
    accessKeySecret: creds.accessKeySecret,
    stsToken: creds.securityToken,
    secure: true,
  })

  return {
    async loadBundle() {
      try {
        const result = await client.get(OBJECT_KEY)
        const text = result.content.toString('utf8')
        return normalizeBundle(JSON.parse(text))
      } catch (err) {
        if (err.code === 'NoSuchKey' || err.status === 404) return emptyBundle()
        throw err
      }
    },

    async saveBundle(bundle) {
      await client.put(OBJECT_KEY, Buffer.from(JSON.stringify(bundle)), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  }
}

module.exports = { createStore }
