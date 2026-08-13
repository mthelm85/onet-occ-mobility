<script lang="ts">
	import results from '$lib/data/results.json';
	import type { Results } from '$lib/types';
	import LineChart from '$lib/components/LineChart.svelte';
	import ThreadRule from '$lib/components/ThreadRule.svelte';
	import OccupationGraph from '$lib/components/OccupationGraph.svelte';
	import PredictionGraph from '$lib/components/PredictionGraph.svelte';
	import Math from '$lib/components/Math.svelte';
	const data = results as unknown as Results;
	const { meta, model_config, training_history, test_metrics, tucker_predictions } = data;

	// Deduplicate mirrored pairs (predictions often include both A→B and B→A)
	function dedupPairs<T extends { source: string; target: string }>(preds: T[]): T[] {
		const seen = new Set<string>();
		return preds.filter((p) => {
			const key = [p.source, p.target].sort().join('|||');
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	const allDeduped = dedupPairs(tucker_predictions);

	// Curated compelling pairs for the graph visualization
	const compellingPairKeys = new Set(
		[
			['Customs and Border Protection Officers', 'First-Line Supervisors of Police and Detectives'],
			[
				'First-Line Supervisors of Police and Detectives',
				'Fraud Examiners, Investigators and Analysts'
			],
			['First-Line Supervisors of Police and Detectives', 'Security Managers'],
			['First-Line Supervisors of Police and Detectives', 'Fire Inspectors and Investigators'],
			['Human Resources Specialists', 'Management Analysts'],
			['Forest Fire Inspectors and Prevention Specialists', 'Environmental Compliance Inspectors']
		].map(([a, b]) => [a, b].sort().join('|||'))
	);

	const compellingPredictions = allDeduped.filter((p) =>
		compellingPairKeys.has([p.source, p.target].sort().join('|||'))
	);
</script>

<svelte:head>
	<title>Knowledge Graph Embeddings for Occupational Mobility</title>
	<meta
		name="description"
		content="Exploring O*NET's graph structure with TuckER to find related occupations"
	/>
</svelte:head>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- TITLE BLOCK                                                           -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<header class="mx-auto max-w-2xl px-6 pt-24 pb-6 text-center">
	<h1
		class="font-serif text-[2.75rem] leading-[1.12] font-bold tracking-tight sm:text-5xl sm:leading-[1.1]"
	>
		Knowledge Graph Embeddings for Occupational Mobility
	</h1>
	<p class="mt-6 font-serif text-xl leading-relaxed text-ink-secondary italic">
		Exploring O*NET's graph structure with TuckER to find related occupations
	</p>
	<p class="mt-8 text-right font-sans text-xs tracking-[0.2em] text-ink-caption uppercase">
		<a href="https://matthelm.pro" target="_blank" rel="noopener" class="hover:text-accent"
			>Matt Helm</a
		>
	</p>
</header>

<hr class="section-rule" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 1: THE CHALLENGE                                              -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="prose-article mx-auto prose prose-lg max-w-2xl px-6 prose-p:leading-[1.8]">
		<h2 class="font-serif text-2xl">The Problem</h2>
		<p>
			If you've ever looked into changing careers, you've probably run into a version of this
			question: <em>which occupations match my current skills?</em> One of the richest resources for
			answering it is
			<a href="https://www.onetonline.org/" target="_blank" rel="noopener">O*NET</a>, the
			Occupational Information Network. It describes 1,016 occupations through detailed profiles
			that include skills, knowledge areas, abilities, tasks, and work activities.
		</p>
		<p>
			The standard approach to finding related occupations is straightforward: look at shared
			elements, and if two occupations have a lot of the same skills and knowledge areas, they're
			probably related. This works, as long as the data is available. However, could there be other
			ways to find occupations that are less obviously related?
		</p>
		<p>
			O*NET publishes its data in
			<a href="https://www.w3.org/RDF/" target="_blank" rel="noopener">RDF</a> — a graph format —
			and that allows us to approach the problem from a different angle. Instead of comparing
			occupation profiles element by element, you can treat the entire dataset as a knowledge graph
			and look for patterns in its <em>structure</em>. This lets you identify related occupations
			even when they don't share many of the same skills, knowledge areas, or abilities.
		</p>
	</div>
</section>

<ThreadRule align="right" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 2: THE KNOWLEDGE GRAPH                                        -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="mx-auto max-w-2xl px-6">
		<div class="prose-article prose prose-lg prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Building the Graph</h2>
			<p>
				I extracted a subgraph from O*NET {meta.onet_version} — a network where occupations, skills, knowledge
				areas, abilities, tasks, and detailed work activities (DWAs) are all nodes, connected by typed
				edges. Here's what a single occupation looks like in that graph:
			</p>
		</div>

		<OccupationGraph nRelations={meta.n_relations} nEntities={meta.n_entities} />

		<div class="prose-article prose prose-lg prose-p:leading-[1.8]">
			<p>
				Each occupation connects to its skills, knowledge areas, abilities, tasks, DWAs, job zone,
				and other related occupations. O*NET has a lot more information than what I've included here
				(work styles, interests, work context, education, wages, and more), but I kept the scope to
				the elements most directly tied to what a person <em>does</em> and <em>knows</em> in a role. I
				also filtered out low-importance elements using O*NET's own importance and level ratings, so the
				graph focuses on the strongest signals.
			</p>
		</div>

		<!-- Stats -->
		<div class="mt-8 flex flex-wrap justify-between gap-y-6 border-t-2 border-b-2 border-ink py-5">
			{#each [{ value: meta.n_entities.toLocaleString(), label: 'entities' }, { value: meta.n_relations, label: 'relation types' }, { value: meta.n_occupations, label: 'occupations' }, { value: meta.n_train_triples.toLocaleString(), label: 'training triples' }] as stat}
				<div class="px-2 text-center">
					<div class="font-serif text-3xl font-bold tabular-nums">{stat.value}</div>
					<div class="mt-0.5 font-sans text-xs tracking-wide text-ink-caption uppercase">
						{stat.label}
					</div>
				</div>
			{/each}
		</div>

		<div class="prose-article prose prose-lg mt-8 prose-p:leading-[1.8]">
			<p>
				Out of the 1,016 occupations in O*NET, {meta.n_occupations} ended up in the graph. The 93 that
				didn't make it are mostly "All Other" residual categories and military specializations — occupations
				without detailed element profiles.
			</p>
			<p>
				For finding related career paths, one can simply compare element profiles
				directly. O*NET already catalogs related occupations, and you can compute similarity scores
				(e.g., Jaccard or cosine similarity) over shared skills, knowledge, and abilities to find
				even more. That works well, but it can only find occupations that look alike on paper. Two
				roles might be structurally related — playing similar roles in the broader occupational
				landscape — without sharing many of the same elements.
			</p>
			<p>
				Since O*NET's data is already structured as a knowledge graph with typed relationships,
				there's another angle worth exploring: models that learn from the <em>pattern</em> of
				connections, not just which elements are shared. To that end, I used a model called
				<a href="https://arxiv.org/abs/1901.09590" target="_blank" rel="noopener">TuckER</a>, which
				learns a low-dimensional representation of every entity and relationship in the graph and
				then uses those representations to predict missing links.
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
		<div class="prose-article prose prose-lg prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">What TuckER Finds</h2>
			<p>
				TuckER works by decomposing the full graph into a small core tensor and two embedding
				matrices — one for entities, one for relations — with far fewer dimensions than the original
				graph. This compression forces the model to learn the underlying patterns that connect
				occupations, skills, knowledge, and other elements, rather than memorizing individual links.
				It can then use those learned representations to score how likely any unobserved link is.
			</p>
			<p>
				I trained the model on the O*NET knowledge graph and ranked all unobserved occupation pairs
				by predicted score, filtering out every pair that O*NET already lists as related. Here are a
				few examples of the top predictions that result:
			</p>
		</div>

		<PredictionGraph predictions={compellingPredictions} />

		<div class="prose-article prose prose-lg prose-p:leading-[1.8]">
			<p>
				The strongest cluster is in law enforcement and public safety. Police supervisors get paired
				with customs officers, fraud examiners, security managers, and fire investigators — all
				roles that share investigative and supervisory patterns, even though O*NET doesn't list them
				as related. Management analysts linked to HR specialists and forest fire inspectors linked
				to environmental compliance inspectors also seem like plausible fits.
			</p>
			<p>
				The results are mixed, though. Judges, magistrate judges, and magistrates are also in the
				same law enforcement cluster, linked to first-line supervisors of police and detectives.
				Clearly, structural similarity in the graph doesn't always translate to a practical career
				move.
			</p>
			<p>
				Here's a table of the top 25 predictions found by TuckER, along with their Jaccard
				similarity:
			</p>
		</div>

		<p class="mt-8 mb-4 font-sans text-sm text-ink-caption">
			Pairs are ranked by TuckER's raw link-prediction score. Jaccard similarity (0–1) measures the
			overlap in skills, knowledge, abilities, tasks, and DWAs between the two occupations.
		</p>
		<div class="overflow-x-auto">
			<table class="table-academic w-full">
				<thead>
					<tr>
						<th class="w-8 text-right">#</th>
						<th>Source</th>
						<th>Target</th>
						<th class="text-right">Score</th>
						<th class="text-right">Jaccard</th>
					</tr>
				</thead>
				<tbody>
					{#each allDeduped.slice(0, 25) as pred, i}
						<tr>
							<td class="text-right text-ink-caption tabular-nums">{i + 1}</td>
							<td class="text-sm">{pred.source}</td>
							<td class="text-sm">{pred.target}</td>
							<td class="text-right font-mono text-sm tabular-nums">{pred.raw_score.toFixed(2)}</td>
							<td class="text-right font-mono text-sm tabular-nums"
								>{pred.overlap.jaccard.toFixed(3)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

<ThreadRule align="left" />

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- SECTION 5: WHY IT MATTERS                                             -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<section class="py-14">
	<div class="mx-auto max-w-2xl px-6">
		<div class="prose-article prose prose-lg prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Why This Matters</h2>
			<p>
				Element-based similarity methods find occupations that look alike on paper — shared skills,
				shared knowledge, shared abilities. TuckER tries a different angle: learning from the <em
					>pattern</em
				> of connections rather than counting shared elements. When it works, it surfaces connections
				like fraud examiners and police supervisors that share investigative reasoning patterns a skills
				checklist might not capture. When it doesn't, you can end up with things like railroad conductors
				paired with commercial pilots — superficially similar in the graph but not in practice.
			</p>
			<p>
				These predictions are hypotheses, not recommendations, and the mixed results suggest this
				approach works better as a starting point. The natural next step would be validation against
				real-world data. The Bureau of Labor Statistics publishes
				<a href="https://www.bls.gov/nls/" target="_blank" rel="noopener"
					>occupational transition data</a
				>
				that could tell us whether these predicted paths correspond to career moves people actually make.
			</p>
			<p>
				TuckER is also just one approach. Other knowledge graph embedding models — <a
					href="https://arxiv.org/abs/1902.10197"
					target="_blank"
					rel="noopener">RotatE</a
				>,
				<a href="https://arxiv.org/abs/1412.6575" target="_blank" rel="noopener">TransR</a>,
				<a href="https://arxiv.org/abs/1707.01476" target="_blank" rel="noopener">ConvE</a> — model
				relational patterns differently and might surface different connections. Graph neural
				network methods like
				<a href="https://arxiv.org/abs/1703.06103" target="_blank" rel="noopener">R-GCN</a>
				could go further by incorporating node features and multi-hop reasoning.
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
		<div class="prose-article prose prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Technical Details</h2>
			<h3 class="font-serif text-xl">Model Architecture</h3>
			<p>
				TuckER uses Tucker decomposition to model relationships in a knowledge graph. For a given
				subject entity <Math tex={'s'} /> and relation <Math tex={'r'} />, it scores all possible
				object entities:
			</p>
		</div>

		<div class="my-6 text-center">
			<Math
				tex={'\\text{score}(s, r, \\cdot) = \\left( \\mathcal{W} \\times_2 \\mathbf{r} \\times_1 \\mathbf{e}_s \\right) \\cdot \\mathbf{E}^\\top'}
				display
			/>
		</div>

		<div class="prose-article prose prose-p:leading-[1.8]">
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
				{#each [['Entity embedding dim', model_config.d_e], ['Relation embedding dim', model_config.d_r], ['Batch size', model_config.batch_size], ['Learning rate (initial)', model_config.lr_initial], ['LR decay (per epoch)', model_config.lr_decay], ['Label smoothing', model_config.label_smoothing], ['Dropout (input / hidden₁ / hidden₂)', `${model_config.input_dropout} / ${model_config.hidden_dropout1} / ${model_config.hidden_dropout2}`], ['Loss function', 'Softmax cross-entropy'], ['Optimizer', model_config.optimizer], ['Max epochs', model_config.epochs_max], ['Actual epochs (early stopping)', model_config.epochs_actual], ['Patience', model_config.patience]] as [label, value]}
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
				<h4 class="mb-2 font-sans text-xs font-semibold tracking-wider text-ink-caption uppercase">
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
				<h4 class="mb-2 font-sans text-xs font-semibold tracking-wider text-ink-caption uppercase">
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
			Filtered link prediction metrics with 95% bootstrap confidence intervals (n = 1,000
			resamples).
		</p>
		<div class="flex flex-wrap justify-between gap-y-6 border-t-2 border-b-2 border-ink py-5">
			{#each [{ label: 'MRR', value: test_metrics.mrr, ci: test_metrics.mrr_ci }, { label: 'Hits@1', value: test_metrics.hits_at_1, ci: test_metrics.hits_at_1_ci }, { label: 'Hits@3', value: test_metrics.hits_at_3, ci: test_metrics.hits_at_3_ci }, { label: 'Hits@10', value: test_metrics.hits_at_10, ci: test_metrics.hits_at_10_ci }] as metric}
				<div class="px-2 text-center">
					<div class="font-serif text-3xl font-bold tabular-nums">
						{(metric.value * 100).toFixed(1)}%
					</div>
					<div
						class="mt-0.5 font-sans text-xs font-semibold tracking-wider text-ink-caption uppercase"
					>
						{metric.label}
					</div>
					<div class="font-sans text-xs text-ink-caption tabular-nums">
						[{(metric.ci[0] * 100).toFixed(1)}–{(metric.ci[1] * 100).toFixed(1)}%]
					</div>
				</div>
			{/each}
		</div>
		<div class="mt-5">
			<span class="font-serif text-3xl font-bold tabular-nums"
				>{test_metrics.mean_rank.toFixed(1)}</span
			>
			<span class="ml-2 font-sans text-sm text-ink-caption"
				>mean rank out of {meta.n_entities.toLocaleString()} entities</span
			>
		</div>

		<!-- Methodology note -->
		<div class="prose-article prose mt-12 prose-p:leading-[1.8]">
			<h3 class="font-serif text-xl">A Note on the Loss Function</h3>
			<p>
				The original TuckER paper uses binary cross-entropy (BCE) loss. That didn't work here. With
				O*NET's extreme class imbalance — roughly 3 positive entities out of
				{meta.n_entities.toLocaleString()} per training example ({(
					(3 / meta.n_entities) *
					100
				).toFixed(3)}%) — BCE lets the model get away with predicting all-negative scores and still
				achieving near-zero loss. The model basically learns to say "nothing is related to
				anything," which isn't very useful.
			</p>
			<p>
				Softmax cross-entropy fixes this by normalizing scores across all entities before computing
				the loss, which forces the model to actually rank positive entities above negatives. There's
				no trivial all-negative solution. Label smoothing (<Math
					tex={`\\varepsilon = ${model_config.label_smoothing}`}
				/>) keeps the model from getting overconfident about its predictions.
			</p>
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- FOOTER                                                                -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<footer class="mt-4 border-t border-rule py-10">
	<div class="mx-auto max-w-2xl px-6 text-center font-sans text-sm text-ink-caption">
		<p>
			Built with O*NET {meta.onet_version} data. Model trained with
			<a
				href="https://lux.csail.mit.edu/"
				class="underline hover:text-accent"
				target="_blank"
				rel="noopener">Lux.jl</a
			>. Results generated {meta.generated}.
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
				href="https://github.com/mthelm85/onet-tucker-model"
				class="underline hover:text-accent"
				target="_blank"
				rel="noopener"
			>
				Source code on GitHub
			</a>
		</p>
	</div>
</footer>
