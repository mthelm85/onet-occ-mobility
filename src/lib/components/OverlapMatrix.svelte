<script lang="ts">
	import type { OverlapSummary } from '$lib/types';

	interface Props {
		overlap: OverlapSummary;
	}

	let { overlap }: Props = $props();

	const methods = ['TuckER', 'Jaccard', 'Bin. Cosine', 'Text Emb.'] as const;
	const n = overlap.tucker_n;

	const matrix: number[][] = [
		[n, overlap.tucker_vs_jaccard, overlap.tucker_vs_binary_cosine, overlap.tucker_vs_text_embedding],
		[overlap.tucker_vs_jaccard, n, overlap.jaccard_vs_binary_cosine, overlap.jaccard_vs_text_embedding],
		[
			overlap.tucker_vs_binary_cosine,
			overlap.jaccard_vs_binary_cosine,
			n,
			overlap.binary_cosine_vs_text_embedding
		],
		[
			overlap.tucker_vs_text_embedding,
			overlap.jaccard_vs_text_embedding,
			overlap.binary_cosine_vs_text_embedding,
			n
		]
	];
</script>

<div class="overflow-x-auto">
	<table class="mx-auto font-serif">
		<thead>
			<tr>
				<th class="p-2.5"></th>
				{#each methods as method}
					<th class="p-2.5 text-center font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-ink-caption min-w-[90px]">
						{method}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each methods as rowMethod, i}
				<tr>
					<td class="p-2.5 pr-4 text-right font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-ink-caption whitespace-nowrap">
						{rowMethod}
					</td>
					{#each methods as _, j}
						<td class="p-2.5 text-center text-lg tabular-nums border-t border-l border-rule text-ink">
							{matrix[i][j]}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="mt-4 text-center font-sans text-sm text-ink-caption leading-relaxed">
	Pairwise overlap between each method's top-{n} predictions.
</p>
