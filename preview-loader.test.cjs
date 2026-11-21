'use strict';
const assert=require('node:assert/strict');
const preview=require('./preview-loader.js');

const payload={
  updated:'2026-11-21T03:00:00.000Z',
  art:{date:'2026-11-20',style:'contours',seed:3,palette:1},
  actions:{generatedAt:'2026-11-21T03:00:00.000Z',items:[{id:'action-1',title:'<img src=x onerror=alert(1)>',source:'Synthetic source',url:'javascript:alert(1)'}]},
  agenda:{items:[{title:'Planning',start:'2026-11-21T04:00:00.000Z',end:'2026-11-21T04:30:00.000Z'}]},
  prs:{items:[{id:42,title:'Review change',url:'https://example.test/pull/42',role:'Yours'}]},
  reviewLibrary:{
    url:'https://example.test/reviews/',
    checkedAt:'2026-11-21T03:00:00.000Z',
    items:[{id:42,title:'Review report',url:'https://example.test/reviews/42',prUrl:'javascript:alert(1)',recommendation:'Approve',state:'Open'}]
  }
};

assert.equal(preview.read('chrome-extension:',payload),null,'the installed extension must ignore optional preview globals');
assert.equal(preview.read('file:',null),null,'a file preview without data should use the clean empty state');
const normalized=preview.read('file:',payload);
assert.equal(normalized.actions.items[0].title,'<img src=x onerror=alert(1)>','display text should remain inert text');
assert.equal(normalized.actions.items[0].url,undefined,'unsafe action URLs should be removed');
assert.equal(normalized.reviewLibrary.items[0].prUrl,undefined,'unsafe review URLs should be removed');
assert.equal(normalized.reviewLibrary.items[0].url,'https://example.test/reviews/42');
console.log('Optional preview loading and untrusted value normalization passed.');
