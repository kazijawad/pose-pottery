const os = require('os');
const cluster = require('cluster');
const { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } = require('fs');
const { resolve, join, dirname, parse } = require('path');
const p5 = require('node-p5');

const cpus = os.cpus().length;
const inputPath = resolve(process.argv[2] || '');
const outputPath = join(inputPath, 'dist');

!existsSync(outputPath) && mkdirSync(outputPath);

const poseColors = [[210, 105,  30],  // nose
                    [255, 127,  80],  // left eye
                    [184, 135,  11],  // right eye
                    [255, 140,   0],  // left ear
                    [255, 160, 122],  // right ear

                    [  0, 100,   0],  // left shoulder
                    [ 85, 107,  47],  // right shoulder
                    [143, 188, 143],  // left elbow
                    [ 34, 139,  34],  // right elbow
                    [ 50, 205,  50],  // left wrist
                    [ 60, 179, 114],  // right wrist

                    [ 70, 130, 180],  // left hip
                    [135, 207, 235],  // right hip
                    [ 65, 105, 225],  // left knee
                    [ 25,  25, 112],  // right knee
                    [173, 216, 230],  // left ankle
                    [ 30, 143, 255]]  // right ankle

if (cluster.isMaster) {
    console.log(`Total CPUS: ${cpus}`);
    console.log(`Master ${process.pid} is running`);

    let baseIndex = 0;

    let jsons = readdirSync(inputPath);
    let jsonIndex = 0;

    if (jsons[0] && jsons[0].includes('.DS_Store')) {
        jsons.shift();
    }

    for (let i = 0; i < cpus; i++) {
        worker = cluster.fork();

        if (jsonIndex < jsons.length && jsonIndex % 8 === 0) {
            worker.send({ path: jsons[jsonIndex], baseIndex });
            baseIndex++;
            jsonIndex += 8;
        }

        worker.on('message', (message) => {
            if (message.success && jsonIndex < jsons.length && jsonIndex % 8 === 0) {
                worker.send({ path: jsons[jsonIndex], baseIndex });
                baseIndex++;
                jsonIndex += 8;
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

    process.on('message', async ({ path, baseIndex }) => {
        if (path && baseIndex) {
            console.log(`Rendering ${baseIndex}: ${path}`);
            await render(join(inputPath, path), baseIndex);
            process.send({ success: true });
        }
    });
}

async function render(path, baseIndex) {
    try {
        if (path.includes('.DS_Store')) return;

        const pose = JSON.parse(readFileSync(path, 'UTF-8'));

        function sketch(p) {
            p.setup = async () => {
                const canvas = p.createCanvas(512, 512);
                p.clear();

                for (let i = 0; i < 17; i++) {
                    p.fill(...poseColors[i], 204);
                    p.noStroke();

                    const x = scale(
                        pose.keypoints[i].position.x,
                        0,
                        1080,
                        0,
                        512
                    );

                    const y = scale(
                        pose.keypoints[i].position.y,
                        0,
                        1920,
                        0,
                        512
                    );

                    p.circle(x, y, scoreToRad(pose.keypoints[i].score));
                }

                await p.saveCanvas(
                    canvas,
                    join(dirname(path), 'dist', `frame${baseIndex}.jpg`),
                    'jpg'
                );

                p.noLoop();
            };
        }

        await p5.createSketch(sketch);
    } catch (err) {
        console.error(path, err);
    }
}

function scoreToRad(score) {
    if (score < 0.5) return 25;
    if (score < 0.75) return 35;
    if (score < 0.9) return 40;
    if (score < 0.95) return 60;
    if (score < 0.98) return 75;
    return 80;
}

function scale(number, inMin, inMax, outMin, outMax) {
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
