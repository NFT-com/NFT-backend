import { NullPhotoBase64 } from '@nftcom/gql/service/nullPhoto.base64'

import { RubikBase64 } from './rubik.base64'
import { RubikBlackBase64 } from './rubikBlack.base64'

export const generateSVG = (profileURL: string): string => {
  return `<svg width="1000" height="1000" viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<path d="M1000 0H0V1000H1000V0Z" fill="url(#pattern0)"/>
<defs>
<style>
@font-face{
font-family:"Rubik"; 
src: url(data:application/font-ttf;charset=utf-8;base64,${RubikBase64}) format('truetype');
}
@font-face{
font-family:"Rubik-Black"; 
src: url(data:application/font-ttf;charset=utf-8;base64,${RubikBlackBase64}) format('truetype');
}
</style>
<pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_7_2" transform="scale(0.000520833)"/>
</pattern>
<image id="image0_7_2" width="1920" height="1920" xlink:href="${NullPhotoBase64}"/>
</defs>
<text style="letter-spacing: 3px;" font-family="Rubik" x="50%" y="850" font-size="30"  text-anchor="middle" fill="#ccc">NFT.COM/</text>
<text font-family="Rubik-Black" x="50%" y="900" font-size="40"  text-anchor="middle" fill="white">${profileURL}</text>
</svg>
`
}
