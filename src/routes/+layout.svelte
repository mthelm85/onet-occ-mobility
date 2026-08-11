<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<div class="min-h-screen paper-bg text-ink">
	{@render children()}
</div>
