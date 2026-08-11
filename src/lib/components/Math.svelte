<script lang="ts">
	import katex from 'katex';

	interface Props {
		tex: string;
		display?: boolean;
	}

	let { tex, display = false }: Props = $props();

	let html = $derived(
		katex.renderToString(tex, {
			displayMode: display,
			throwOnError: false,
			strict: false
		})
	);
</script>

{@html html}
