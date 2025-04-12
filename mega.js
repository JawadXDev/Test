import * as mega from 'megajs';

// Delay utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// MEGA credentials
const auth = {
    email: 'pathumchinthaka634@gmail.com',
    password: '95811320pathum',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

const upload = async (data, name) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`Using MEGA account: ${auth.email}`);
            
            // Add 5-second delay before logging in
            await delay(3000);

            const storage = new mega.Storage(auth, () => {
                const uploader = storage.upload({ name, allowUploadBuffering: true });
                data.pipe(uploader);

                storage.on("add", (file) => {
                    file.link((err, url) => {
                        storage.close();
                        if (err) {
                            reject(err);
                        } else {
                            resolve(url);
                        }
                    });
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};

export { upload };
