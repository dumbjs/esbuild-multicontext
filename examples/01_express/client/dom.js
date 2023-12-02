export const h = (tagName, attrs, ...children) => {
  const node = document.createElement(tagName)

  Object.entries(attrs).forEach(([k, v]) => {
    if (k in node) {
      node[k] = v
    } else {
      node.setAttribute(k, v)
    }
  })

  children.forEach(child => {
    if (child.__domNode) {
      child(node)
    } else if (child instanceof Node) {
      node.appendChild(child)
    } else if (typeof child == 'string') {
      node.appendChild(document.createTextNode(child))
    }
  })

  const mounter = mountOn => mountOn.appendChild(node)
  mounter.__domNode = true
  return mounter
}
