importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.2.0/workbox-sw.js');

// workbox.setConfig({
//   debug: true
// });

workbox.googleAnalytics.initialize();

workbox.precaching.precacheAndRoute([
  {
    "url": "account.html",
    "revision": "e6ce140e16fae4503275f03b2db24bbc"
  },
  {
    "url": "app/advanced.html",
    "revision": "584ad4caa30aaa1ba7886c21b99771a0"
  },
  {
    "url": "app/css/main.css",
    "revision": "d2bb59a349bd966fd77e4608c87b1bc1"
  },
  {
    "url": "app/css/start-dark.css",
    "revision": "1d4d7e2a58517bf28e5172dfe124ac7e"
  },
  {
    "url": "app/css/start-light.css",
    "revision": "9a1806508df34722ec60d08bd0bc2852"
  },
  {
    "url": "app/css/start.css",
    "revision": "422e3561372aff0b5ed87c32c2b6ecbd"
  },
  {
    "url": "app/icons/svue-512.png",
    "revision": "1a73afdf0d465ebe265aa45b62d6615c"
  },
  {
    "url": "app/icons/svue-ios-167.png",
    "revision": "afcf43b70ea06b0ec0f27ce66b5d6299"
  },
  {
    "url": "app/icons/svue-ios-180.png",
    "revision": "b9a0285fc740c030cc3bb26575def110"
  },
  {
    "url": "app/icons/svue.png",
    "revision": "2b13b3794ed64d4210bc643bf3504da7"
  },
  {
    "url": "app/images/d-af.jpg",
    "revision": "e6bcceac4e2129b9cf47e6238fb4889e"
  },
  {
    "url": "app/images/d-ss.jpg",
    "revision": "f2a4e3bbbe11050d19d2bf617fa59388"
  },
  {
    "url": "app/images/ios-add-dark.jpg",
    "revision": "d269898069e3b813a3cb9e7bd7163e5e"
  },
  {
    "url": "app/images/ios-add-light.jpg",
    "revision": "c5d89031d4a1a9da87493bbea5907cfd"
  },
  {
    "url": "app/images/ios-share.png",
    "revision": "d7704f6cffa4dc8343df27f3b79203d5"
  },
  {
    "url": "app/images/n.jpg",
    "revision": "cb46947a84088957b37a2a82c22f3c1d"
  },
  {
    "url": "app/install-ios.html",
    "revision": "aabf43abc781562b9245cb2cd81d7df3"
  },
  {
    "url": "app/install.html",
    "revision": "f5d7d0af751116abffa09cac4d15eb28"
  },
  {
    "url": "app/js/installLib-iOS.js",
    "revision": "dc76a0515197531da058aba85f19c288"
  },
  {
    "url": "app/js/installLib.js",
    "revision": "d69a645e416375b1f79dfb6812942f38"
  },
  {
    "url": "app/js/pwacompat.min.js",
    "revision": "e01a1337eccd46ca0237ea98d5b1cf31"
  },
  {
    "url": "app/js/start.js",
    "revision": "2ec85dab46cc11db6ddcc648ecafaaa7"
  },
  {
    "url": "app/js/themeInit.js",
    "revision": "e9cc877e2f32f069b469379400925b9f"
  },
  {
    "url": "app/start.html",
    "revision": "b442f1a275164ca7c2e0e08e774bdd2d"
  },
  {
    "url": "changelog/full.html",
    "revision": "dec31d8af3ecdd5946aff246f770bcac"
  },
  {
    "url": "css/account.css",
    "revision": "8ea2590eecff03383cd854c7afd7ec68"
  },
  {
    "url": "css/auth-dark.css",
    "revision": "f98baa936e85f94d27fb3770fd830b22"
  },
  {
    "url": "css/auth.css",
    "revision": "7b305f065ac3688bf4b0b36bde734afb"
  },
  {
    "url": "css/bkimg-dark.css",
    "revision": "f0f511cd86d0a248db3649ac7bd32f0f"
  },
  {
    "url": "css/bkimg-light.css",
    "revision": "e43aa3fb8f9d0ff3a92a0d4054aa36b0"
  },
  {
    "url": "css/changelog.css",
    "revision": "7919f52e690058d6400727cee7255d91"
  },
  {
    "url": "css/core.css",
    "revision": "f9bbb13cdd996f0802e0a1435f6f90aa"
  },
  {
    "url": "css/landing-dark.css",
    "revision": "7f239914ad595b88b87785044552aecc"
  },
  {
    "url": "css/landing.css",
    "revision": "66252d9bd441a0998d4d044aaecdabb2"
  },
  {
    "url": "css/legal.css",
    "revision": "504500a4e62d50f6a473886cca0d2607"
  },
  {
    "url": "css/main.css",
    "revision": "26561925e7c065a2a5f15b768cc1e500"
  },
  {
    "url": "css/materialize/dark.css",
    "revision": "97768d5ecfd7a43296ee270be1fb7b82"
  },
  {
    "url": "css/materialize/light.css",
    "revision": "6ff155f120b96d8ece187a6e93b079ae"
  },
  {
    "url": "css/secondary.css",
    "revision": "6ae3bed93d71ffed37fa4fa1af5402d1"
  },
  {
    "url": "export.html",
    "revision": "b31515a55d7470a827427635d4036cce"
  },
  {
    "url": "images/icon-sm.png",
    "revision": "7d1e4987cb0df43987cc67d01539edbc"
  },
  {
    "url": "images/icon.png",
    "revision": "1a73afdf0d465ebe265aa45b62d6615c"
  },
  {
    "url": "images/mountains-night.icon.jpg",
    "revision": "2becb0c383ff580cad824bf2105f9543"
  },
  {
    "url": "images/mountains-night.jpg",
    "revision": "32896ba7ea557c808c32c54847b40f59"
  },
  {
    "url": "images/mountains.icon.jpg",
    "revision": "6e478868c74f0aadc6a9896a03acebac"
  },
  {
    "url": "images/mountains.jpg",
    "revision": "8e14f73c0dc5656c7d7fdf2b8d060832"
  },
  {
    "url": "images/night.jpg",
    "revision": "9d45254f2a3ef1ac755062af4e2c5e20"
  },
  {
    "url": "images/scenic-dark.jpg",
    "revision": "ad27d507037cd30370229a32ce535a39"
  },
  {
    "url": "images/sun-dark.jpg",
    "revision": "e86df27c9c290529bed5d57098db53d9"
  },
  {
    "url": "index.html",
    "revision": "5eea5493f342b9d68683aa2f8e84ccf5"
  },
  {
    "url": "js/account.js",
    "revision": "22666b738877e25a9d5f3a0c050e47c7"
  },
  {
    "url": "js/core.js",
    "revision": "84dd8a60307d580c7f3b843f2fc05c93"
  },
  {
    "url": "js/fa.js",
    "revision": "943677bd5d4b6696d2e3ddcf6c7b4f6e"
  },
  {
    "url": "js/landing.js",
    "revision": "b31658c6401d0b395eb0d0ff52cfbd38"
  },
  {
    "url": "js/main.js",
    "revision": "d2e5beedbce1cead4b82744528a9347c"
  },
  {
    "url": "js/notifier.js",
    "revision": "52ffcc0cf8ccebf5c427139a613ba4ee"
  },
  {
    "url": "js/reauth.js",
    "revision": "46ef880a240e975b0fc16b84c11864c3"
  },
  {
    "url": "js/secondary.js",
    "revision": "090ff16c147302682db9690be45ffee7"
  },
  {
    "url": "js/signin.js",
    "revision": "306276af44e3fbb03d065801a4f6449d"
  },
  {
    "url": "js/signout.js",
    "revision": "cb85e9af8463f92e6bc9ecbeeb6c2583"
  },
  {
    "url": "js/svuelib.js",
    "revision": "d3d3f3177746360a227a2dfa8eb47b18"
  },
  {
    "url": "js/ver.js",
    "revision": "ef13a4ec888e206f3f9923f009c61f13"
  },
  {
    "url": "js/wa-client.js",
    "revision": "82532300be9f5729fd40924874b19b42"
  },
  {
    "url": "js/zepto.min.js",
    "revision": "320f7882fa008d9893896818e8b1f765"
  },
  {
    "url": "legal.html",
    "revision": "1c5c65b8bad85ab876a2f47528e0bee4"
  },
  {
    "url": "signin/demo.html",
    "revision": "6de66bb3c6ba4ac75783dd23669c1010"
  },
  {
    "url": "signin/demo.js",
    "revision": "87cd3cc83342df4160254f399ff00164"
  },
  {
    "url": "signin/reauth.html",
    "revision": "395903a7b89a4af380c9f8ee97750d71"
  },
  {
    "url": "signout.html",
    "revision": "02fea246975ffe0cbc5fa896b89ade6b"
  },
  {
    "url": "static/changelog/full.html",
    "revision": "3f56fabd05474aaf306e2c0c0e12614b"
  }
]);
workbox.precaching.precacheAndRoute([{
  url: '/dashboard?app=1', 
  revision: '1603239212'
}], {
  ignoreURLParametersMatching: [/.*/]
});

workbox.routing.registerRoute(
  '/signin',
  new workbox.strategies.StaleWhileRevalidate()
);

workbox.routing.registerRoute(
  'https://unpkg.com/animejs@3.0.1/lib/anime.min.js',
  new workbox.strategies.CacheFirst(),
);

workbox.routing.registerRoute(
  new RegExp('^https://use.typekit.net/'),
  new workbox.strategies.CacheFirst(),
);

workbox.routing.registerRoute(
  new RegExp('^https://cdn.jsdelivr.net/'),
  new workbox.strategies.CacheFirst(),
);

workbox.routing.registerRoute(
  new RegExp('^https://cdnjs.cloudflare.com/'),
  new workbox.strategies.CacheFirst(),
);

self.addEventListener('install', event => {
  // don't wait
  console.log('installed'); 
  event.waitUntil(self.skipWaiting()); 
});

self.addEventListener('activate', event => {
  self.clients.claim().then(r => {
    self.clients.matchAll().then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({msg: 'The OpenVUE SW was updated.', code: 200});
      });
    });
  }); 
})