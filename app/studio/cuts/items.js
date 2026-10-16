// 計画のカット1つ → 描ける文字アイテム（世界つきなら世界の箱で、なければ実際の広がりで置く）。画面（layer.js）とテストで同じ作り方を使うための小さな入口。
import {buildItem} from './glyphs.js';
import {buildWorldItem} from './worlds.js';
import {placeLine} from '../omakase.js';
import {wordPieces} from '../word-size.js';

/**
 * 字ごとの部品で描いた文字の置き場所。置き場所は、文字の実際の広がり（item.bbox）で決める。
 * 置きたい場所に収まらなければ、小さくするか中央に戻す（placeLine と同じ）。
 */
export function placeItem(item,cut,view={width:960,height:540}){
 const fs=Math.min(view.width,view.height)*cut.fontScale;
 const extent={w:(item.bbox.x1-item.bbox.x0)/fs,h:(item.bbox.y1-item.bbox.y0)/fs};
 const place=cut.placeName&&cut.placeName!=='self'?cut.placeName:'center';
 return placeLine({chars:item.n,fontScale:cut.fontScale,view,place,rotation:cut.place?.rotation||0,scale:cut.place?.scale||1,extent});
}

/** dScale（検査と手直しが付ける、文字の拡大）と、書体の既定（gFont がなければ baseFont）を反映する */
export function buildAnyItem(cut,{W=960,H=540,measure,baseFont='gothic',fontFamily}={}){
 const c2={...cut,fontScale:cut.fontScale*(cut.dScale||1),gFont:cut.gFont||baseFont},pieces=wordPieces(cut.text);
 let it;
 if(cut.world){it=buildWorldItem(c2,{W,H,measure,pieces,fontFamily});it.place={x:.5,y:.5,scale:1,rotation:0};}   // 世界は自分で置き場所を決める
 else{it=buildItem(c2,{W,H,measure,pieces,fontFamily});it.place=placeItem(it,c2,{width:W,height:H});}
 return it;
}
