import type { Command } from '../../commands.js'

const stickers = {
  type: 'local',
  name: 'stickers',
  description: 'Order Semiclaw Code stickers',
  supportsNonInteractive: false,
  load: () => import('./stickers.js'),
} satisfies Command

export default stickers
