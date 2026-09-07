/** 生产站地址：分享时始终用此 URL，避免 localhost 无法打开 */
export const APP_SHARE_URL = 'https://kuka36.github.io/PanassetLite/'

export const ABOUT_URL = 'https://mp.weixin.qq.com/s/du0wh1As2s-casSadFAgZQ'

export const SHARE_TAGLINE = '轻量本地优先的个人资产管理'

export const SHARE_BLURB =
  '不注册、不上传，数据只存在你的浏览器里。'

export function buildShareText(): string {
  return [
    `推荐一个本地优先的个人资产管理工具：PanassetLite`,
    SHARE_BLURB,
    APP_SHARE_URL,
  ].join('\n')
}
