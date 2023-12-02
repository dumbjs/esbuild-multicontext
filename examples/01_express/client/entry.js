import { h } from './dom.js'

const text = h('p', {}, 'Hello world!')
const mountOn = h('div', {}, text)

mountOn(document.body)
