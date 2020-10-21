const workboxBuild = require('workbox-build');
const fs = require('fs');
const path = require('path'); 

const base = require('path').resolve(__dirname, '..');
console.log(base);

// NOTE: This should be run *AFTER* all your assets are built
const buildSW = () => {
  // This will return a Promise
  return workboxBuild.injectManifest({
    // swSrc: '../protected/sw-template.js',
    swSrc: path.join(__dirname, 'resources', 'sw-template.js'),
    swDest: path.join(base, 'public', 'sw.js'), 
    globDirectory: path.join(base, 'public'),
    globPatterns: [
      '**\/*.{js,css,html,png,jpg}'
    ], 
    globIgnores: ['signin.html', 'images/samples/*', 'admin/*', 'changelog.html', 'signin/admin.html', 'signin/auth.css', 'signin/auth.js', 'images/pier.jpg', 'images/scenic.jpg', 'static/*']
  }).then(({count, size, warnings}) => {
    // Optionally, log any warnings and details.
    warnings.forEach(console.warn);
    console.log(`${count} files will be precached, totaling ${size} bytes (${Math.round(size/1024/1024*10)/10} mb).`);
    fs.readFile(path.join(base, 'public', 'sw.js'), 'utf-8', (e, data) => {
      if(e) console.warn(e); 
      let out = data.replace(/%d/g, Math.round(Date.now()/1000)); 
      fs.writeFile(path.join(base, 'public', 'sw.js'), out, 'utf8', (e) => {
        if(e) console.warn(e); 
        console.log('-> Updated cache revision for /dashboard');
      })
    })
  });
}

buildSW();