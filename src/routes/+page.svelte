<script lang="ts">
	import results from '$lib/data/results.json';
	import type { Results, TuckerPrediction } from '$lib/types';
	import LineChart from '$lib/components/LineChart.svelte';
	import OverlapMatrix from '$lib/components/OverlapMatrix.svelte';
	import BaselineTabs from '$lib/components/BaselineTabs.svelte';
	import ZeroOverlapGraph from '$lib/components/ZeroOverlapGraph.svelte';
	import ThreadRule from '$lib/components/ThreadRule.svelte';
	import Math from '$lib/components/Math.svelte';
	import { slide } from 'svelte/transition';

	const data = results as unknown as Results;
	const { meta, model_config, training_history, test_metrics, tucker_predictions, baselines, overlap } = data;

	let expandedRow = $state(-1);

	function truncate(s: string, n: number = 46): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	function jaccard0Predictions(): TuckerPrediction[] {
		return tucker_predictions.filter((p) => p.overlap.jaccard === 0);
	}

	// Deduplicate mirrored pairs in TuckER predictions
	function dedupPredictions(preds: TuckerPrediction[]): TuckerPrediction[] {
		const seen = new Set<string>();
		return preds.filter((p) => {
			const key = [p.source, p.target].sort().join('|||');
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	const top25 = dedupPredictions(tucker_predictions).slice(0, 25);
</script>

<svelte:head>
	<title>Knowledge Graph Embeddings for Occupational Mobility</title>
	<meta
		name="description"
		content="Using TuckER to find career pathways in O*NET that traditional similarity methods miss."
	/>
</svelte:head>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- TITLE BLOCK                                                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<header class="mx-auto max-w-2xl px-6 pt-24 pb-6 text-center">
	<h1 class="font-serif text-[2.75rem] leading-[1.12] font-bold tracking-tight sm:text-5xl sm:leading-[1.1]">
		Knowledge Graph Embeddings for Occupational Mobility
	</h1>
	<p class="mt-6 text-xl leading-relaxed text-ink-secondary font-serif italic">
		Finding career pathways in O*NET that traditional similarity methods miss.
	</p>
	<p class="mt-8 font-sans text-xs uppercase tracking-[0.2em] text-ink-caption text-right">
		<a href="https://matthelm.pro" target="_blank" rel="noopener" class="hover:text-accent">Matt Helm</a>
	</p>
</header>

<hr class="section-rule" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 1: THE CHALLENGE                                              -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="prose prose-article mx-auto max-w-2xl px-6 prose-lg prose-p:leading-[1.8]">
		<h2 class="font-serif text-2xl">The Problem</h2>
		<p class="drop-cap">
			If you've ever looked into changing careers, you've probably run into a version of this
			question: <em>which occupations match my current skills?</em> One of the richest
			resources for answering it is
			<a href="https://www.onetonline.org/" target="_blank" rel="noopener">O*NET</a>, the
			Occupational Information Network, which describes 1,016 occupations through detailed
			profiles — skills, knowledge areas, abilities, tasks, and work activities. It
			underpins many of the career exploration tools used across the country.
		</p>
		<p>
			The standard approach to finding related occupations is straightforward. You look at
			shared elements — if two occupations have a lot of the same skills and knowledge areas,
			they're probably related. And that works, as long as both occupations actually have
			those annotations filled in.
		</p>
		<p>
			But what if some occupations are missing half their profile? And what if there are
			meaningful relationships hiding in the <em>structure</em> of the data that simple
			element comparisons can't see? That's what I set out to explore.
		</p>
	</div>
</section>

<ThreadRule align="right" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 2: THE KNOWLEDGE GRAPH                                        -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="mx-auto max-w-2xl px-6">
		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Building the Graph</h2>
			<p>
				O*NET already publishes its data as <a href="https://www.w3.org/RDF/" target="_blank" rel="noopener">RDF</a>, so it's naturally suited to knowledge graph
				work. I extracted a subgraph from O*NET {meta.onet_version} — a network where
				occupations, skills, knowledge areas, abilities, tasks, and detailed work activities
				(DWAs) are all nodes, connected by typed edges. An occupation "has skill" Critical
				Thinking, "requires knowledge" of Mathematics, and so on. O*NET contains a lot more
				information than what's in this subgraph — work styles, interests, work context,
				education requirements, wages, and more — but I kept the scope to the elements most
				directly tied to what a person <em>does</em> and <em>knows</em> in a role. I also
				filtered each element type to only the most important ones per occupation, based on
				O*NET's own importance and level ratings, to keep the graph focused on the strongest
				signals.
			</p>
		</div>

		<!-- Stats -->
		<div class="mt-8 flex flex-wrap justify-between gap-y-6 border-t-2 border-b-2 border-ink py-5">
			{#each [
				{ value: meta.n_entities.toLocaleString(), label: 'entities' },
				{ value: meta.n_relations, label: 'relation types' },
				{ value: meta.n_occupations, label: 'occupations' },
				{ value: meta.n_train_triples.toLocaleString(), label: 'training triples' }
			] as stat}
				<div class="text-center px-2">
					<div class="text-3xl font-serif font-bold tabular-nums">{stat.value}</div>
					<div class="mt-0.5 font-sans text-xs tracking-wide uppercase text-ink-caption">{stat.label}</div>
				</div>
			{/each}
		</div>

		<div class="prose prose-article mt-8 prose-lg prose-p:leading-[1.8]">
			<p>
				Out of the 1,016 occupations in O*NET, {meta.n_occupations} ended up in the graph.
				The 93 that didn't make it are mostly "All Other" residual categories and military
				specializations — occupations without detailed element profiles.
			</p>
			<p>
				Here's where it gets interesting: even among the {meta.n_occupations} occupations
				that <em>are</em> in the graph, <strong>not all have complete annotations</strong>.
				Some occupations — Data Scientists, Financial Risk Specialists, Cardiologists, to
				name a few — have task data but are missing their skill, knowledge, and ability
				ratings. This turns out to be a real problem for traditional similarity methods,
				as we'll see.
			</p>
		</div>
	</div>
</section>

<hr class="section-rule" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 3: BASELINES                                                  -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="mx-auto max-w-2xl px-6">
		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Three Baselines</h2>
			<p>
				Before reaching for anything fancy, I wanted to see how far simple methods could
				go. I tried three approaches, each a bit more sophisticated than the last.
			</p>
			<p>
				<strong>Jaccard similarity</strong> is the most straightforward. For each pair of
				occupations, count the elements they share — skills, knowledge areas, abilities,
				tasks, DWAs — and divide by the total number of unique elements across both. If
				occupation A has 30 elements and B has 25, with 15 in common, their Jaccard
				similarity is <Math tex={'15 / (30 + 25 - 15) = 0.375'} />. This is essentially
				what a SPARQL query would give you.
			</p>
			<p>
				<strong>Binary cosine similarity</strong> uses the same data but normalizes
				differently. Each occupation becomes a binary vector over all possible elements — a
				1 for each element it has, 0 otherwise — and I compute the cosine of the angle
				between them:
			</p>
		</div>
		<div class="my-4 text-center">
			<Math tex={'\\cos(\\theta) = \\frac{\\mathbf{a} \\cdot \\mathbf{b}}{\\|\\mathbf{a}\\| \\, \\|\\mathbf{b}\\|}'} display />
		</div>
		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<p>
				This rewards occupations that share elements relative to their profile sizes,
				rather than penalizing larger profiles the way Jaccard does.
			</p>
			<p>
				<strong>Text embedding similarity</strong> takes a completely different tack. I
				embedded each occupation's title using a language model (<a href="https://huggingface.co/BAAI/bge-m3" target="_blank" rel="noopener">bge-m3</a>) and computed
				cosine similarity in the resulting vector space. This captures semantic
				meaning — "Nuclear Technicians" and "Nuclear Engineers" end up close
				together — but uses no graph structure at all.
			</p>
		</div>

		<div class="mt-8">
			<BaselineTabs {baselines} />
		</div>

		<div class="prose prose-article mt-8 prose-lg prose-p:leading-[1.8]">
			<p>
				The pattern is pretty clear. Jaccard and cosine are comparing sets of shared
				elements — they don't use the graph structure (the type of relationship, the
				predicates), just whether two occupations share the same subjects and objects.
				The text embedding baseline finds occupations with similar <em>names</em>.
				And all three hit the same wall: they can only compare occupations on dimensions
				where <em>both</em> have data.
			</p>
			<p>
				So what if we used an approach that actually learns from the graph structure?
				That's where knowledge graph embedding models come in. I used one called
				<a href="https://arxiv.org/abs/1901.09590" target="_blank" rel="noopener">TuckER</a>,
				which learns a low-dimensional representation of every entity and relationship
				in the graph, then uses those representations to predict missing links.
			</p>
		</div>
	</div>
</section>

<ThreadRule align="right" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 4: WHAT TUCKER FINDS                                          -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="mx-auto max-w-2xl px-6">
		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">What TuckER Finds</h2>
			<p>
				The key idea is that two occupations can be related not because they share the
				same skills, but because they play similar <em>structural roles</em> in the
				graph. TuckER decomposes the pattern of connections into a set of latent factors,
				and uses those to score how likely any unobserved link is.
			</p>
			<p>
				I trained a TuckER model on the O*NET knowledge graph and ranked all unobserved
				occupation pairs by predicted score. I found that there was no overlap at all
				between the model's top predictions and the three baseline methods:
			</p>
		</div>

		<!-- Overlap matrix -->
		<div class="mt-10">
			<h3 class="mb-4 text-center font-sans text-sm font-semibold uppercase tracking-wider text-ink-caption">
				Prediction Overlap
			</h3>
			<OverlapMatrix {overlap} />
		</div>

		<div class="prose prose-article mt-8 prose-lg prose-p:leading-[1.8]">
			<p>
				The Jaccard and cosine baselines overlap heavily with each other
				({overlap.jaccard_vs_binary_cosine} of 50 shared) — which makes sense, since
				they're looking at the same underlying data. But TuckER doesn't share a single top
				prediction with any of them. It's finding relationships in a completely different
				part of the space.
			</p>
		</div>
	</div>

	<!-- Predictions table — wider for readability -->
	<div class="mx-auto mt-10 max-w-3xl px-6">
		<h3 class="mb-1 font-serif text-xl font-semibold text-ink">
			Top 25 TuckER Predictions
		</h3>
		<p class="mb-5 font-sans text-sm text-ink-caption">
			None of these pairs appear in any baseline's top-50 list. The Jaccard column shows
			element-level similarity between each pair — <span class="text-accent">highlighted
			rows</span> have zero shared elements. Click a row for the breakdown.
		</p>
		<table class="table-academic">
			<thead>
				<tr>
					<th class="w-10 text-right">#</th>
					<th>Source</th>
					<th>Target</th>
					<th class="text-right">Jaccard</th>
				</tr>
			</thead>
			<tbody>
				{#each top25 as pred, i}
					<tr
						class="cursor-pointer {pred.overlap.jaccard === 0 ? '!bg-accent-bg' : ''}"
						onclick={() => (expandedRow = expandedRow === i ? -1 : i)}
					>
						<td class="text-right text-ink-caption tabular-nums">{i + 1}</td>
						<td>{truncate(pred.source)}</td>
						<td>{truncate(pred.target)}</td>
						<td class="text-right tabular-nums font-mono text-xs {pred.overlap.jaccard === 0 ? 'font-semibold text-accent' : 'text-ink-caption'}">
							{pred.overlap.jaccard.toFixed(3)}
						</td>
					</tr>
					{#if expandedRow === i}
						<tr class="!bg-transparent hover:!bg-transparent">
							<td colspan="4" class="!p-0 !border-b-0">
								<div transition:slide={{ duration: 300 }} class="py-4">
									<div class="flex flex-wrap gap-6 justify-center">
										{#each [
											{ label: 'Skills', val: pred.overlap.shared_skills },
											{ label: 'Knowledge', val: pred.overlap.shared_knowledge },
											{ label: 'Abilities', val: pred.overlap.shared_abilities },
											{ label: 'Tasks', val: pred.overlap.shared_tasks },
											{ label: 'DWAs', val: pred.overlap.shared_dwas },
											{ label: 'Same Job Zone', val: pred.overlap.same_jobzone ? '✓' : '—' }
										] as item}
											<div class="text-center">
												<div class="text-xl font-serif font-bold tabular-nums {item.val === 0 ? 'text-accent' : ''}">
													{item.val}
												</div>
												<div class="font-sans text-xs uppercase tracking-wide text-ink-caption">{item.label}</div>
											</div>
										{/each}
									</div>
									{#if pred.overlap.jaccard === 0}
										<p class="mt-3 text-center font-sans text-xs text-ink-caption italic">
											Zero shared elements — TuckER infers this link from task relationships and graph structure alone.
										</p>
									{/if}
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</section>

<ThreadRule align="left" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 5: WHY IT MATTERS                                             -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="mx-auto max-w-2xl px-6">
		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Why This Matters</h2>
			<p>
				The zero-overlap result is interesting on its own, but the really useful part is
				<em>why</em> the predictions differ. Look at TuckER's most confident predictions
				that have a Jaccard similarity of exactly zero:
			</p>
		</div>

		<!-- Jaccard=0 predictions: interactive graph -->
		<ZeroOverlapGraph predictions={jaccard0Predictions()} />

		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<p>
				These aren't zero because the occupations are unrelated — they're zero because
				one or both occupations are missing their skill, knowledge, and ability annotations
				entirely. The only element data they have is tasks. Jaccard, cosine, text
				embeddings — none of them can do anything useful here. TuckER finds these
				connections by reasoning over task relationships and graph structure alone.
			</p>
			<p>
				This matters for workforce development because O*NET is a living database.
				Occupations get added and revised regularly, and not all of them have complete
				element profiles — some are missing skill, knowledge, or ability ratings entirely.
				For those occupations, the standard career exploration tools are effectively blind.
				Knowledge graph embeddings can help fill that gap — not by replacing
				element-based methods, but by finding what they can't see.
			</p>
			<p>
				Of course, structural similarity in a graph doesn't always translate to a
				practical career path. Veterinarians and Cardiologists play similar roles in the
				graph — both diagnose, treat, and perform procedures — but the training
				pipelines are very different. These predictions are better understood as signals
				worth exploring, not direct recommendations.
			</p>
			<p>
				It's also worth noting that TuckER is just one approach. Other knowledge graph
				embedding models — <a href="https://arxiv.org/abs/1902.10197" target="_blank" rel="noopener">RotatE</a>,
				<a href="https://arxiv.org/abs/1412.6575" target="_blank" rel="noopener">TransR</a>,
				<a href="https://arxiv.org/abs/1707.01476" target="_blank" rel="noopener">ConvE</a> — model
				relational patterns differently and might surface different connections.
				Graph neural network methods like
				<a href="https://arxiv.org/abs/1703.06103" target="_blank" rel="noopener">R-GCN</a>
				could go further by incorporating node features and multi-hop reasoning.
				The point here isn't that TuckER is the answer — it's that the structural
				information in O*NET's knowledge graph is worth using, and the standard
				tools aren't using it yet.
			</p>
			<p>
				What I'd do next is validate these predictions against real-world data — the
				Bureau of Labor Statistics publishes
				<a href="https://www.bls.gov/nls/" target="_blank" rel="noopener">occupational transition data</a>
				that could tell us whether TuckER's predicted mobility paths actually correspond
				to career moves people make. And since I only tried one embedding method here,
				the natural follow-up is to benchmark those other approaches I mentioned — RotatE,
				ConvE, R-GCN — on the same graph and see which ones surface the most useful
				predictions.
			</p>
		</div>
	</div>
</section>

<hr class="section-rule" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 6: TECHNICAL DETAILS                                          -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="mx-auto max-w-2xl px-6">
		<div class="prose prose-article prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Technical Details</h2>
			<h3 class="font-serif text-xl">Model Architecture</h3>
			<p>
				TuckER uses Tucker decomposition to model knowledge graph relationships. For a
				given subject entity <Math tex={'s'} /> and relation <Math tex={'r'} />, it
				scores all possible object entities:
			</p>
		</div>

		<div class="my-6 text-center">
			<Math tex={'\\text{score}(s, r, \\cdot) = \\left( \\mathcal{W} \\times_2 \\mathbf{r} \\times_1 \\mathbf{e}_s \\right) \\cdot \\mathbf{E}^\\top'} display />
		</div>

		<div class="prose prose-article prose-p:leading-[1.8]">
			<p>
				where <Math tex={'\\mathcal{W}'} /> is a learnable core tensor,
				<Math tex={'\\mathbf{e}_s'} /> is the subject entity embedding,
				<Math tex={'\\mathbf{r}'} /> is the relation embedding, and
				<Math tex={'\\mathbf{E}'} /> is the full entity embedding matrix.
			</p>
		</div>

		<!-- Hyperparameters -->
		<h3 class="mt-12 mb-4 font-serif text-xl font-semibold text-ink">Hyperparameters</h3>
		<table class="table-academic">
			<thead>
				<tr>
					<th>Parameter</th>
					<th class="text-right">Value</th>
				</tr>
			</thead>
			<tbody>
				{#each [
					['Entity embedding dim', model_config.d_e],
					['Relation embedding dim', model_config.d_r],
					['Batch size', model_config.batch_size],
					['Learning rate (initial)', model_config.lr_initial],
					['LR decay (per epoch)', model_config.lr_decay],
					['Label smoothing', model_config.label_smoothing],
					['Dropout (input / hidden₁ / hidden₂)', `${model_config.input_dropout} / ${model_config.hidden_dropout1} / ${model_config.hidden_dropout2}`],
					['Loss function', 'Softmax cross-entropy'],
					['Optimizer', model_config.optimizer],
					['Max epochs', model_config.epochs_max],
					['Actual epochs (early stopping)', model_config.epochs_actual],
					['Patience', model_config.patience]
				] as [label, value]}
					<tr>
						<td>{label}</td>
						<td class="text-right font-mono text-sm">{value}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Training curves — full width, large -->
		<h3 class="mt-12 mb-4 font-serif text-xl font-semibold text-ink">Training Curves</h3>
		<div class="space-y-8">
			<div>
				<h4 class="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption">
					Training Loss
				</h4>
				<LineChart
					data={training_history.losses}
					color="oklch(0.32 0.012 260)"
					gradientId="lossGrad"
					yLabel="Loss"
					formatY={(v) => v.toFixed(1)}
					height={320}
				/>
			</div>
			<div>
				<h4 class="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption">
					Validation MRR
				</h4>
				<LineChart
					data={training_history.val_mrr}
					color="oklch(0.45 0.14 25)"
					gradientId="mrrGrad"
					yLabel="MRR"
					formatY={(v) => v.toFixed(4)}
					height={320}
				/>
			</div>
		</div>

		<!-- Test metrics -->
		<h3 class="mt-12 mb-4 font-serif text-xl font-semibold text-ink">Test Set Evaluation</h3>
		<p class="mb-5 font-sans text-sm text-ink-caption">
			Filtered link prediction metrics with 95% bootstrap confidence intervals (n = 1,000 resamples).
		</p>
		<div class="flex flex-wrap justify-between gap-y-6 border-t-2 border-b-2 border-ink py-5">
			{#each [
				{ label: 'MRR', value: test_metrics.mrr, ci: test_metrics.mrr_ci },
				{ label: 'Hits@1', value: test_metrics.hits_at_1, ci: test_metrics.hits_at_1_ci },
				{ label: 'Hits@3', value: test_metrics.hits_at_3, ci: test_metrics.hits_at_3_ci },
				{ label: 'Hits@10', value: test_metrics.hits_at_10, ci: test_metrics.hits_at_10_ci }
			] as metric}
				<div class="text-center px-2">
					<div class="text-3xl font-serif font-bold tabular-nums">{(metric.value * 100).toFixed(1)}%</div>
					<div class="mt-0.5 font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption">{metric.label}</div>
					<div class="font-sans text-xs text-ink-caption tabular-nums">
						[{(metric.ci[0] * 100).toFixed(1)}–{(metric.ci[1] * 100).toFixed(1)}%]
					</div>
				</div>
			{/each}
		</div>
		<div class="mt-5">
			<span class="text-3xl font-serif font-bold tabular-nums">{test_metrics.mean_rank.toFixed(1)}</span>
			<span class="ml-2 font-sans text-sm text-ink-caption">mean rank out of {meta.n_entities.toLocaleString()} entities</span>
		</div>

		<!-- Methodology note -->
		<div class="prose prose-article mt-12 prose-p:leading-[1.8]">
			<h3 class="font-serif text-xl">A Note on the Loss Function</h3>
			<p>
				The original TuckER paper uses binary cross-entropy (BCE) loss. That didn't work
				here. With O*NET's extreme class imbalance — roughly 3 positive entities out of
				{meta.n_entities.toLocaleString()} per training example
				({(3 / meta.n_entities * 100).toFixed(3)}%) — BCE lets the model get away with
				predicting all-negative scores and still achieving near-zero loss. The model
				basically learns to say "nothing is related to anything," which isn't very useful.
			</p>
			<p>
				Softmax cross-entropy fixes this by normalizing scores across all entities before
				computing the loss, which forces the model to actually rank positive entities
				above negatives. There's no trivial all-negative solution. Label smoothing
				(<Math tex={`\\varepsilon = ${model_config.label_smoothing}`} />) keeps the model
				from getting overconfident about its predictions.
			</p>
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- FOOTER                                                                -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<footer class="border-t border-rule mt-4 py-10">
	<div class="mx-auto max-w-2xl px-6 text-center font-sans text-sm text-ink-caption">
		<p>
			Built with O*NET {meta.onet_version} data. Model trained with
			<a href="https://lux.csail.mit.edu/" class="underline hover:text-accent" target="_blank" rel="noopener">Lux.jl</a>.
			Results generated {meta.generated}.
		</p>
		<p class="mt-2">
			<a
				href="https://matthelm.pro"
				class="underline hover:text-accent"
				target="_blank"
				rel="noopener"
			>
				matthelm.pro
			</a>
			&nbsp;·&nbsp;
			<a
				href="https://github.com/mthelm85/onet-occ-mobility"
				class="underline hover:text-accent"
				target="_blank"
				rel="noopener"
			>
				Source code on GitHub
			</a>
		</p>
	</div>
</footer>
