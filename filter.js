const a = [1, 2, 3, 4, 5]
const b = [2, 4, 6]

const c = a.filter(A => {
  for (let i = 0; i < b.length; i++) {
    if (b[i] == A) { return true }
  }
  return false
})

console.log('c: ', c)