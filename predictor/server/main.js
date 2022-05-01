const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const tf = require('@tensorflow/tfjs-node');
const posenet = require('@tensorflow-models/posenet');
const p5 = require('node-p5');
const { createCanvas, Image } = require('canvas');

(async function() {
    const port = 5001;

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

    const app = express();

    const net = await posenet.load();

    app.use(cors({ origin: true }));
    app.use(bodyParser.json({ limit: '1000mb' }));

    app.post('/export', async (req, res) => {
        try {
            const image = new Image();

            image.onload = async () => {
                const canvas = createCanvas(image.width, image.height);
                const context = canvas.getContext('2d');

                context.drawImage(image, 0, 0);

                const input = tf.browser.fromPixels(canvas);
                const pose = await net.estimateSinglePose(input);

                await render(res, pose);
            };

            image.src = req.body.image;
        } catch (err) {
            res.status(500).send({ success: false, message: err.message });
        }
    });

    app.listen(port, () => {
        console.log(`Listening on http://localhost:${port}`);
    });

    async function render(res, pose) {
        function sketch(p) {
            p.setup = async () => {
                const canvas = p.createCanvas(512, 512);

                p.clear();
                p.background('#000');

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

                p.noLoop();

                const image = canvas.canvas.toDataURL('image/png');

                res.send({ success: true, image });
            };
        }

        await p5.createSketch(sketch);
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
})();
