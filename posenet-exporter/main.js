const os = require('os');
const cluster = require('cluster');
const { writeFileSync, existsSync, mkdirSync, readdirSync } = require('fs');
const { join, dirname, parse } = require('path');
const { createCanvas, loadImage } = require('canvas');
const tf = require('@tensorflow/tfjs-node');
const posenet = require('@tensorflow-models/posenet');

const cpus = os.cpus().length;
const inputPath = join(__dirname, process.argv[2] || '');
const outputPath = join(inputPath, 'dist');

!existsSync(outputPath) && mkdirSync(outputPath);

if (cluster.isMaster) {
    console.log(`Total CPUS: ${cpus}`);
    console.log(`Master ${process.pid} is running`);

    const images = readdirSync(inputPath);
    let imageIndex = 0;

    for (let i = 0; i < cpus; i++) {
        worker = cluster.fork();

        if (imageIndex < images.length) {
            worker.send({ imagePath: images[imageIndex] });
            imageIndex++;
        }

        worker.on('message', (message) => {
            if (message.success && imageIndex < images.length) {
                worker.send({ imagePath: images[imageIndex] });
                imageIndex++;
            }
        });
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        console.log('Forking another Worker');
        cluster.fork();
    });
} else {
    console.log(`Worker ${process.pid} started`);

    process.on('message', async (message) => {
        if (message.imagePath) {
            await render(join(inputPath, message.imagePath));
            process.send({ success: true });
        }
    });
}

async function render(imagePath) {
    try {
        if (imagePath.includes('.DS_Store')) return;

        const net = await posenet.load();

        const image = await loadImage(imagePath)

        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const input = tf.browser.fromPixels(canvas);
        const pose = await net.estimateSinglePose(input);

        const outputJSONPath = join(dirname(imagePath), 'dist', `${parse(imagePath).name}.json`);

        writeFileSync(outputJSONPath, JSON.stringify(pose));
        console.log(`Saved ${outputJSONPath}`);
    } catch (err) {
        console.error(imagePath, err);
    }
}
