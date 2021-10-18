importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.2.0/workbox-sw.js');

// workbox.setConfig({
//   debug: true
// });

workbox.googleAnalytics.initialize();

workbox.precaching.precacheAndRoute([
  {
    "url": "account.html",
    "revision": "3a09b97a47c289e1698dc01082504806"
  },
  {
    "url": "app/advanced.html",
    "revision": "fcb4a9626d9afd89e4e2c17fab71d9bc"
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
    "revision": "4d66c9ec7f084f8b93b84147656d09bd"
  },
  {
    "url": "app/install.html",
    "revision": "3a3fd6173c08b14c8ccef30e4d42cdf3"
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
    "revision": "a894b95317dd28537b2518a096a07521"
  },
  {
    "url": "changelog/full.html",
    "revision": "c14cda6f8296d550f20bcdf25af153b5"
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
    "revision": "da404a055613f25c213ddfe79222f95d"
  },
  {
    "url": "css/materialize/light.css",
    "revision": "6ff155f120b96d8ece187a6e93b079ae"
  },
  {
    "url": "css/secondary.css",
    "revision": "cfa80387ec4617e0aa849c6e4dad6265"
  },
  {
    "url": "export.html",
    "revision": "3b609feaf6818ff306b8f387c25e9928"
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
    "revision": "0c422d19de2259082e09ac069d23a987"
  },
  {
    "url": "js/account.js",
    "revision": "22666b738877e25a9d5f3a0c050e47c7"
  },
  {
    "url": "js/core.js",
    "revision": "082569d3d43e55ec7e7414cd6f975376"
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
    "revision": "044eb7b009a8b1fd5e77a36696bb953b"
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
    "revision": "d690e0cabae0ff05896a36a901938088"
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
    "revision": "9ea581b7ae49173a765c1452521657c0"
  },
  {
    "url": "js/ver.js",
    "revision": "76f3fd5b8b6563aa33f90c001046d5b8"
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
    "revision": "4cf8762a7681b46336ef80a8ab723828"
  },
  {
    "url": "signin/demo.html",
    "revision": "4efedcaeb07c8d0f842ec9163686a828"
  },
  {
    "url": "signin/demo.js",
    "revision": "87cd3cc83342df4160254f399ff00164"
  },
  {
    "url": "signin/reauth.html",
    "revision": "445f89651673ee72f75d9406cea29995"
  },
  {
    "url": "signout.html",
    "revision": "53cf99b5bab6841905b9bd88eed6987d"
  },
  {
    "url": "static/changelog/full.html",
    "revision": "738ffaa45d9b485d57ca3da2ea95abb0"
  }
]);
workbox.precaching.precacheAndRoute([{
  url: '/dashboard?app=1', 
  revision: '1634534390'
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