<script lang="ts">
	import type { Baselines, BaselinePrediction } from '$lib/types';

	interface Props {
		baselines: Baselines;
	}

	let { baselines }: Props = $props();

	const tabs = [
		{ key: 'jaccard' as const, label: 'Jaccard' },
		{ key: 'binary_cosine' as const, label: 'Binary Cosine' },
		{ key: 'text_embedding' as const, label: 'Text Embedding' }
	];

	function dedup(preds: BaselinePrediction[]): BaselinePrediction[] {
		const seen = new Set<string>();
		return preds.filter((p) => {
			const key = [p.source, p.target].sort().join('|||');
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	let activeTab = $state<keyof Baselines>('jaccard');
	let activeBaseline = $derived(baselines[activeTab]);
	let rows = $derived(dedup(activeBaseline.top).slice(0, 10));

	function truncate(s: string, n: number = 46): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}
</script>

<div>
	<!-- Tab bar -->
	<div class="flex gap-1 mb-4 font-sans text-sm">
		{#each tabs as tab}
			<button
				class="px-3 py-1.5 transition-colors duration-100
					{activeTab === tab.key
					? 'text-ink border-b-2 border-ink font-semibold'
					: 'text-ink-caption hover:text-ink'}"
				onclick={() => (activeTab = tab.key)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Method description -->
	<p class="font-sans text-sm text-ink-caption mb-4 italic">
		{activeBaseline.method}
	</p>

	<!-- Table -->
	<table class="table-academic">
		<thead>
			<tr>
				<th class="w-10 text-right">#</th>
				<th>Source Occupation</th>
				<th>Target Occupation</th>
				<th class="text-right">Score</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as pred, i}
				<tr>
					<td class="text-right text-ink-caption tabular-nums">{i + 1}</td>
					<td>{truncate(pred.source)}</td>
					<td>{truncate(pred.target)}</td>
					<td class="text-right tabular-nums font-mono text-xs text-ink-caption">
						{pred.score.toFixed(4)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
