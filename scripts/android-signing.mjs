import {readFile,writeFile} from 'node:fs/promises';
const getEnv=key=>process.env[`PHOENIX_${key}`];
for(const name of ['KEYSTORE_BASE64','STORE_PASSWORD','KEY_ALIAS','KEY_PASSWORD','KEYSTORE_PATH'])if(!getEnv(name))throw new Error(`Missing PHOENIX_${name}. Configure the four Android repository secrets; release never substitutes a debug key.`);
await writeFile(getEnv('KEYSTORE_PATH'),Buffer.from(getEnv('KEYSTORE_BASE64'),'base64'),{mode:0o600});
const path='android/app/build.gradle';
let gradle=await readFile(path,'utf8');
if(!gradle.includes('// Phoenix release signing'))gradle+=`
// Phoenix release signing: secrets remain in environment, never in source.
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("PHOENIX_KEYSTORE_PATH"))
            storePassword(System.getenv("PHOENIX_STORE_PASSWORD"))
            keyAlias(System.getenv("PHOENIX_KEY_ALIAS"))
            keyPassword(System.getenv("PHOENIX_KEY_PASSWORD"))
        }
    }
    buildTypes { release { signingConfig signingConfigs.release } }
}
`;
await writeFile(path,gradle);
