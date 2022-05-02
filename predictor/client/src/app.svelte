<script>
    import Poses from 'components/poses.svelte';
    import Mask from 'components/mask.svelte';
    import Output from 'components/output.svelte';
</script>

<main>
    <Poses />
    <Mask />
    <Output />
</main>

<style>
    main {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        height: 100vh;
        padding: 1rem;
        background-color: var(--c-off-white);
    }
</style>
