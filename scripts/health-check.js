const fs = require('fs');

console.log('🔍 Health Check Starting...\n');
console.log(`✅ Node.js version: ${process.version}`);

const dirs = ['src', 'scripts'];
dirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(`✅ Directory exists: ${dir}/`);
    } else {
        console.log(`❌ Missing directory: ${dir}/`);
    }
});

const files = ['src/index.js', 'package.json'];
files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ File exists: ${file}`);
    } else {
        console.log(`❌ Missing file: ${file}`);
    }
});

console.log('\n🎉 Health check complete!');
