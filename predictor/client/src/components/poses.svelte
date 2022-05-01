<script>
    import { onMount } from 'svelte';
    import { output } from 'store';

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

    let camera;
    let video;
    let canvas;

    let net;
    let width = 512;
    let height = 0;
    let streaming = false;

    onMount(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

            video.srcObject = stream;
            video.play();
        } catch (err) {
            console.error(err);
        }
    });

    function handleCanPlay() {
        if (!streaming) {
            height = video.videoHeight / (video.videoWidth / width);

            video.setAttribute('width', '100%');
            video.setAttribute('height', height);
            canvas.setAttribute('width', '100%');
            canvas.setAttribute('height', height);

            streaming = true;
        }
    }

    async function handleClick() {
        const context = canvas.getContext('2d');
        if (width && height) {
            canvas.width = width;
            canvas.height = height;

            context.drawImage(video, 0, 0, width, height);

            const image = canvas.toDataURL('image/png');

            let response = await fetch('http://localhost:5001/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image })
            });
            let data = await response.json();

            response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: data.image })
            });
            data = await response.json();

            output.set(data.image);
        } else {
            output.set('assets/uv.png');
        }
    }
</script>

<section bind:this={camera}>
    <video bind:this={video} on:canplay={handleCanPlay}>
        Video stream not available.
        <track kind="captions">
    </video>
    <button on:click|preventDefault={handleClick}>Take Photo</button>
    <canvas bind:this={canvas}></canvas>
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        grid-column: 1 / 7;
        border: 0.1rem solid var(--c-black);
    }

    canvas {
        display: none;
    }

    button {
        margin-top: 1rem;
        padding: 1rem;
        font-size: 2rem;
        border: 0.1rem solid var(--c-black);
        border-radius: 0.2rem;
        background-color: var(--c-off-white);
        color: var(--c-black);
        transition: all 0.3s;
    }

    button:hover {
        background-color: var(--c-black);
        color: var(--c-white);
    }
</style>
