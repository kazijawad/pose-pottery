<script>
    import { onDestroy } from 'svelte';
    import { output } from 'store';

    let photo;

    const unsubscribe = output.subscribe((value) => {
        if (value) {
            photo.setAttribute('src', value);
        }
    });

    onDestroy(unsubscribe);
</script>

<section>
    <img
        bind:this={photo}
        src="assets/uv.png"
        alt="A generated pot will appear in this box."
    >
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        grid-column: 7 / -1;
        border: 0.1rem solid var(--c-black);
        border-left: none;
    }

    img {
        height: 512px;
        width: 100%;
        object-fit: contain;
    }
</style>
