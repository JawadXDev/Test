import * as mega from 'megajs';

// Array of Mega credentials
const megaCredentials = [
    { email: 'gqm9i7i@tmpnator.live', password: 'subzero123' },
    { email: 'yidrepeydi@gufum.com', password: 'subzero123' },
    { email: 'vastebaspi@gufum.com', password: 'subzero123' },
    { email: 'mistemalmo@gufum.com', password: 'subzero123' },
    { email: 'hurderarte@gufum.com', password: 'subzero123' }
];

const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        try {
            // Randomly select credentials from the array
            const randomCreds = megaCredentials[Math.floor(Math.random() * megaCredentials.length)];
            
            const auth = {
                email: randomCreds.email,
                password: randomCreds.password,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
            };

            const storage = new mega.Storage(auth, () => {
                data.pipe(storage.upload({ name: name, allowUploadBuffering: true }));
                storage.on("add", (file) => {
                    file.link((err, url) => {
                        if (err) {
                            storage.close();
                            reject(err);
                        } else {
                            storage.close();
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
