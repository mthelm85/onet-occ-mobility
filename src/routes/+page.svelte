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
	const compellingPairKeys = new Set([
		['Customs and Border Protection Officers', 'First-Line Supervisors of Police and Detectives'],
		['First-Line Supervisors of Police and Detectives', 'Fraud Examiners, Investigators and Analysts'],
		['First-Line Supervisors of Police and Detectives', 'Security Managers'],
		['First-Line Supervisors of Police and Detectives', 'Fire Inspectors and Investigators'],
		['Human Resources Specialists', 'Management Analysts'],
		['Forest Fire Inspectors and Prevention Specialists', 'Environmental Compliance Inspectors'],
	].map(([a, b]) => [a, b].sort().join('|||')));

	const compellingPredictions = allDeduped.filter(p =>
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
	<h1 class="font-serif text-[2.75rem] leading-[1.12] font-bold tracking-tight sm:text-5xl sm:leading-[1.1]">
		Knowledge Graph Embeddings for Occupational Mobility
	</h1>
	<p class="mt-6 text-xl leading-relaxed text-ink-secondary font-serif italic">
		Exploring O*NET's graph structure with TuckER to find related occupations
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
		<p>
			If you've ever looked into changing careers, you've probably run into a version of this
			question: <em>which occupations match my current skills?</em> One of the richest
			resources for answering it is
			<a href="https://www.onetonline.org/" target="_blank" rel="noopener">O*NET</a>, the
			Occupational Information Network. It describes 1,016 occupations through detailed
			profiles that include skills, knowledge areas, abilities, tasks, and work activities.
		</p>
		<p>
			The standard approach to finding related occupations is straightforward: look at
			shared elements, and if two occupations have a lot of the same skills and knowledge areas,
			they're probably related. This works, as long as both occupations actually have
			those elements.
		</p>
		<p>
			O*NET publishes its data in
			<a href="https://www.w3.org/RDF/" target="_blank" rel="noopener">RDF</a> — a graph
			format — and that opens up a different class of techniques. Instead of comparing
			occupation profiles element by element, you can treat the entire dataset as a
			knowledge graph and look for patterns in its <em>structure</em>. That lets you
			identify related occupations even when they don't share the same skills, knowledge,
			or abilities — or when those annotations are missing entirely.
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
				I extracted a subgraph from O*NET {meta.onet_version} — a network where
				occupations, skills, knowledge areas, abilities, tasks, and detailed work activities
				(DWAs) are all nodes, connected by typed edges. Here's what a single occupation
				looks like in that graph:
			</p>
		</div>

		<OccupationGraph nRelations={meta.n_relations} nEntities={meta.n_entities} />

		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<p>
				Each occupation connects to its skills, knowledge areas, abilities, tasks, DWAs,
				job zone, and other related occupations. O*NET
				has a lot more information than what I've included here (work styles, interests,
				work context, education, wages, and more), but I kept the scope to the elements
				most directly tied to what a person <em>does</em> and <em>knows</em> in a role.
				I also filtered out low-importance elements using O*NET's own importance and
				level ratings, so the graph focuses on the strongest signals.
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
				One thing to note is that <strong>not all of these occupations have complete
				annotations</strong>. Some — Data Scientists, Financial Risk Specialists,
				Cardiologists — have task data but are missing their skill, knowledge, and
				ability ratings. For fully annotated occupations, finding related career
				paths is straightforward: O*NET already catalogs related occupations, and
				you can compute element-based similarity (Jaccard overlap, cosine similarity)
				to find more. But for occupations with incomplete profiles, those methods
				are working with a much weaker signal.
			</p>
			<p>
				Since O*NET's data is already structured as a knowledge graph with typed
				relationships, there's another angle worth exploring: models that learn from
				the <em>pattern</em> of connections, not just which elements are shared. I
				used a model called
				<a href="https://arxiv.org/abs/1901.09590" target="_blank" rel="noopener">TuckER</a>,
				which learns a low-dimensional representation of every entity and relationship
				in the graph and then uses those representations to predict missing links.
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
				The idea is that two occupations can be related not because they share the
				same skills, but because they play similar <em>structural roles</em> in the
				graph. TuckER decomposes the pattern of connections into a set of latent factors
				and uses those to score how likely any unobserved link is.
			</p>
			<p>
				I trained the model on the O*NET knowledge graph and ranked all unobserved
				occupation pairs by predicted score, filtering out every pair that O*NET already
				lists as related. Here are some of the predictions that stood out — click any
				node to see its O*NET profile:
			</p>
		</div>

		<PredictionGraph predictions={compellingPredictions} />

		<div class="prose prose-article prose-lg prose-p:leading-[1.8]">
			<p>
				The strongest cluster is in law enforcement and public safety. Police
				Supervisors get paired with Customs Officers, Fraud Examiners, Security
				Managers, and Fire Investigators — all roles that share investigative and
				supervisory patterns, even though O*NET doesn't list them as related.
				Management Analysts linked to HR Specialists and Forest Fire Inspectors
				linked to Environmental Compliance Inspectors are also good fits.
			</p>
			<p>
				While this revealed many interesting predictions, there were also many that 
				were clearly erroneous. Railroad Conductors and Commercial
				Pilots both show up in the top 25 as a predicted pair — they're both in
				transportation, but the actual career paths, training, and certifications
				are completely different. That's a case where structural similarity in the
				graph doesn't translate to a practical career move.
			</p>
		</div>
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
				O*NET is a living database. Occupations get added and revised regularly,
				and not all of them have complete element profiles yet. For those
				occupations, element-based methods are working with limited data —
				task overlap alone is a much weaker signal than a full profile comparison.
				Knowledge graph embeddings can extract more from those limited connections
				by reasoning over the structure of the graph rather than just counting
				shared elements.
			</p>
			<p>
				Even for occupations with complete profiles, TuckER surfaces connections
				that element overlap doesn't. A dispatcher and an air traffic controller
				don't top each other's similarity scores, but both coordinate traffic
				in high-stakes environments. A fraud examiner and a police supervisor
				share investigative reasoning patterns that don't reduce to a skills
				checklist. These are the kinds of connections that emerge from structural
				patterns in the graph.
			</p>
			<p>
				As the Railroad Conductors example shows, structural similarity doesn't
				always translate to a practical career path. These predictions are
				hypotheses, not recommendations. The natural next step would be validation
				against real-world data — the Bureau of Labor Statistics publishes
				<a href="https://www.bls.gov/nls/" target="_blank" rel="noopener">occupational transition data</a>
				that could tell us whether these predicted paths correspond to career moves
				people actually make.
			</p>
			<p>
				TuckER is also just one approach. Other knowledge graph embedding
				models — <a href="https://arxiv.org/abs/1902.10197" target="_blank" rel="noopener">RotatE</a>,
				<a href="https://arxiv.org/abs/1412.6575" target="_blank" rel="noopener">TransR</a>,
				<a href="https://arxiv.org/abs/1707.01476" target="_blank" rel="noopener">ConvE</a> — model
				relational patterns differently and might surface different connections.
				Graph neural network methods like
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
		<div class="prose prose-article prose-p:leading-[1.8]">
			<h2 class="font-serif text-2xl">Technical Details</h2>
			<h3 class="font-serif text-xl">Model Architecture</h3>
			<p>
				TuckER uses Tucker decomposition to model relationships in a knowledge graph.
				For a given subject entity <Math tex={'s'} /> and relation <Math tex={'r'} />,
				it scores all possible object entities:
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
