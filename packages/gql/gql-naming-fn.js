const { pascalCase, isUpperCase } = require('change-case-all')

/**
 *
 * @param str string
 * @return string
 */
function getName(str) {
  // console.log('before', str)
  if (isUpperCase(str)) {
    // console.log('returning as is')
    return str
  }
  let result = pascalCase(str).replace('Nft', 'NFT').replace('NfT', 'NFT')
  // console.log('after pascalCase', result)
  // if (result.includes('Nft') || (result.includes('NfT'))) {
  //   console.log('includes variation of Nft')
  //   result = result.replace('Nft', 'NFT').replace('NfT', 'NFT')
  // }
  // const result = pascalCase(str)
  // console.log('after', result)
  return result
}

module.exports = getName
