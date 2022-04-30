let pose;
let index = 0;
let poseColors = [[210, 105,  30],  // nose
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

function preload() {
    let url = '/dist7254/IMG_72540000.json'; // make this compute
    pose = loadJSON(url);
    console.log(pose);
}

function setup() {
    createCanvas(1080, 1920);
    jsonLoop();
}

function plotPose(pose) {
    console.log(pose);
    console.log(index);
    clear();
    for (var i = 0; i < 17; i++) {
        fill(...poseColors[i], 204);
        noStroke();
        circle(pose.keypoints[i].position.x, 
               pose.keypoints[i].position.y, 
               scoreToRad(pose.keypoints[i].score));
    }
    save('IMG' + '7254' + itos(index) + '.png');
}

function sleep(ms) {
    return new Promise(resolve => {setTimeout(() => { resolve(true); }, 500); });
}

async function jsonLoop() {
    for(; index < 1181; index++) {
        let url = '/dist7254/IMG_7254' + itos(index) + '.json'; // make this compute
        pose = await loadJSON(url, plotPose);
        await sleep(500);
    }
}

function itos(num) {
    if (num < 10) {
        return '000' + num;
    }
    if (num < 100) {
        return '00' + num;
    }
    if (num < 1000) {
        return '0' + num;
    }
    return num;
}

function scoreToRad(score) {
    if (score < 0.5) return 25;
    if (score < 0.75) return 35;
    if (score < 0.9) return 40;
    if (score < 0.95) return 60;
    if (score < 0.98) return 75;
    return 80;
}
