<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { TuckerPrediction } from '$lib/types';
	import occupationElements from '$lib/data/occupation_elements.json';

	interface Props {
		predictions: TuckerPrediction[];
	}

	let { predictions }: Props = $props();

	// ── Build graph data ──
	type Node = {
		id: string;
		x: number;
		y: number;
		vx: number;
		vy: number;
		isHub: boolean;
		hasFullData: boolean;
	};
	type Edge = { source: string; target: string };

	const uniqueOccs = new Set<string>();
	predictions.forEach((p) => {
		uniqueOccs.add(p.source);
		uniqueOccs.add(p.target);
	});

	// Count connections to find hubs
	const connCount = new Map<string, number>();
	predictions.forEach((p) => {
		connCount.set(p.source, (connCount.get(p.source) || 0) + 1);
		connCount.set(p.target, (connCount.get(p.target) || 0) + 1);
	});

	const elemData = occupationElements as Record<
		string,
		{
			title: string;
			soc: string;
			skills: { name: string; score: number }[];
			knowledge: { name: string; score: number }[];
			abilities: { name: string; score: number }[];
			tasks: string[];
		}
	>;

	// Initial positions: two clusters
	const hubs = [...connCount.entries()].filter(([, c]) => c >= 3).map(([id]) => id);
	const leftHub = hubs.find((h) => connCount.get(h)! >= 5) || hubs[0];
	const rightHub = hubs.find((h) => h !== leftHub) || hubs[1];

	function initNodes(): Node[] {
		const nodes: Node[] = [];
		const W = 700, H = 440;
		const cx1 = W * 0.3, cx2 = W * 0.7, cy = H * 0.5;

		for (const id of uniqueOccs) {
			const isHub = id === leftHub || id === rightHub;
			const hasData = elemData[id] && elemData[id].skills.length > 0;

			let ix: number, iy: number;
			if (id === leftHub) {
				ix = cx1;
				iy = cy;
			} else if (id === rightHub) {
				ix = cx2;
				iy = cy;
			} else {
				// Spoke of which hub?
				const isLeftSpoke = predictions.some(
					(p) =>
						(p.source === leftHub && p.target === id) ||
						(p.target === leftHub && p.source === id)
				);
				const center = isLeftSpoke ? cx1 : cx2;
				const angle = Math.random() * Math.PI * 2;
				const r = 100 + Math.random() * 40;
				ix = center + Math.cos(angle) * r;
				iy = cy + Math.sin(angle) * r;
			}

			nodes.push({ id, x: ix, y: iy, vx: 0, vy: 0, isHub, hasFullData: hasData });
		}
		return nodes;
	}

	// Force simulation
	function simulate(nodes: Node[], edges: Edge[], iterations: number = 200): Node[] {
		const W = 700, H = 440;
		const k = 120; // ideal spring length
		const repulsion = 18000;
		const attraction = 0.02;
		const damping = 0.92;
		const gravity = 0.01;

		for (let iter = 0; iter < iterations; iter++) {
			const temp = 1 - iter / iterations;

			// Repulsion between all node pairs
			for (let i = 0; i < nodes.length; i++) {
				for (let j = i + 1; j < nodes.length; j++) {
					let dx = nodes[i].x - nodes[j].x;
					let dy = nodes[i].y - nodes[j].y;
					const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
					const force = (repulsion / (dist * dist)) * temp;
					const fx = (dx / dist) * force;
					const fy = (dy / dist) * force;
					nodes[i].vx += fx;
					nodes[i].vy += fy;
					nodes[j].vx -= fx;
					nodes[j].vy -= fy;
				}
			}

			// Attraction along edges
			for (const edge of edges) {
				const a = nodes.find((n) => n.id === edge.source)!;
				const b = nodes.find((n) => n.id === edge.target)!;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
				const force = attraction * (dist - k) * temp;
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				a.vx += fx;
				a.vy += fy;
				b.vx -= fx;
				b.vy -= fy;
			}

			// Gravity toward center
			for (const node of nodes) {
				node.vx += (W / 2 - node.x) * gravity * temp;
				node.vy += (H / 2 - node.y) * gravity * temp;
			}

			// Apply velocities
			for (const node of nodes) {
				node.vx *= damping;
				node.vy *= damping;
				node.x += node.vx;
				node.y += node.vy;
				// Clamp to bounds
				node.x = Math.max(60, Math.min(W - 60, node.x));
				node.y = Math.max(40, Math.min(H - 40, node.y));
			}
		}

		return nodes;
	}

	const edges: Edge[] = predictions.map((p) => ({ source: p.source, target: p.target }));
	const layoutNodes = simulate(initNodes(), edges);

	// Make a map for quick lookup
	const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

	// ── Interaction state ──
	let selectedNode = $state<string | null>(null);
	let panelEl: HTMLDivElement | undefined = $state();
	let prevPanelHeight = 0;

	function selectNode(id: string) {
		selectedNode = selectedNode === id ? null : id;
	}

	let selectedData = $derived(selectedNode ? elemData[selectedNode] : null);
	let selectedNodeObj = $derived(selectedNode ? nodeMap.get(selectedNode) : null);

	// Animate height changes when switching between nodes
	$effect.pre(() => {
		selectedNode; // track
		if (panelEl) {
			prevPanelHeight = panelEl.offsetHeight;
		}
	});

	$effect(() => {
		selectedNode; // track
		if (!panelEl || prevPanelHeight === 0) return;

		const newHeight = panelEl.offsetHeight;
		if (prevPanelHeight !== newHeight) {
			panelEl.animate(
				[
					{ height: prevPanelHeight + 'px', overflow: 'hidden' },
					{ height: newHeight + 'px', overflow: 'hidden' }
				],
				{ duration: 300, easing: 'ease-out' }
			);
		}
	});

	// Short occupation labels
	function shortLabel(name: string): string {
		if (name.length <= 22) return name;
		// Abbreviate common patterns
		return name.replace(/, Except Pediatric/, '').replace(/Interviewers and Clerks/, 'Interv. & Clerks');
	}
</script>

<div class="my-8">
	<h3
		class="mb-5 text-center font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption"
	>
		Predictions with Zero Element Overlap
	</h3>

	<div class="relative">
		<!-- SVG Graph -->
		<svg viewBox="0 0 700 440" class="w-full select-none" role="img">
			<!-- Edges -->
			{#each edges as edge}
				{@const a = nodeMap.get(edge.source)}
				{@const b = nodeMap.get(edge.target)}
				{#if a && b}
					<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						stroke="var(--color-rule)"
						stroke-width="1.5"
					/>
				{/if}
			{/each}

			<!-- Nodes -->
			{#each layoutNodes as node}
				{@const isSelected = selectedNode === node.id}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<g
					class="cursor-pointer"
					onclick={() => selectNode(node.id)}
					role="button"
					tabindex="0"
				>
					<!-- Outer glow when selected -->
					{#if isSelected}
						<circle cx={node.x} cy={node.y} r={node.isHub ? 18 : 13} fill="var(--color-accent)" opacity="0.15" />
					{/if}
					<!-- Node circle -->
					<circle
						cx={node.x}
						cy={node.y}
						r={node.isHub ? 12 : 8}
						fill={isSelected ? 'var(--color-accent)' : node.hasFullData ? 'var(--color-ink)' : 'var(--color-paper)'}
						stroke={isSelected ? 'var(--color-accent)' : 'var(--color-ink)'}
						stroke-width={node.hasFullData ? 0 : 2}
						class="transition-all duration-150"
					/>
					<!-- Label -->
					<text
						x={node.x}
						y={node.y + (node.isHub ? 22 : 17)}
						text-anchor="middle"
						font-size={node.isHub ? '11' : '10'}
						font-family="var(--font-serif)"
						fill={isSelected ? 'var(--color-accent)' : 'var(--color-ink)'}
						font-weight={isSelected ? '700' : node.isHub ? '600' : '400'}
						class="transition-all duration-150"
					>
						{shortLabel(node.id)}
					</text>
				</g>
			{/each}
		</svg>

		<!-- Detail panel -->
		{#if selectedData && selectedNodeObj}
			<div
				bind:this={panelEl}
				class="mt-2 border-t border-rule pt-4 pb-2"
				transition:slide={{ duration: 300 }}
			>
				<h4 class="font-serif text-lg font-semibold text-ink mb-3">
					{selectedNode}
				</h4>

				{#if !selectedData.skills.length && !selectedData.knowledge.length && !selectedData.abilities.length}
					<p class="font-sans text-sm text-ink-caption italic mb-3">
						This occupation is missing skill, knowledge, and ability ratings in O*NET — only task data is available. This is exactly why TuckER's structural approach matters.
					</p>
				{/if}

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
					{#if selectedData.skills.length > 0}
						<div>
							<h5 class="font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption mb-1.5">
								Skills
							</h5>
							<ul class="space-y-0.5">
								{#each selectedData.skills as skill}
									<li class="font-serif text-sm text-ink-secondary">{skill.name}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if selectedData.knowledge.length > 0}
						<div>
							<h5 class="font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption mb-1.5">
								Knowledge
							</h5>
							<ul class="space-y-0.5">
								{#each selectedData.knowledge as k}
									<li class="font-serif text-sm text-ink-secondary">{k.name}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if selectedData.abilities.length > 0}
						<div>
							<h5 class="font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption mb-1.5">
								Abilities
							</h5>
							<ul class="space-y-0.5">
								{#each selectedData.abilities as ability}
									<li class="font-serif text-sm text-ink-secondary">{ability.name}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if selectedData.tasks.length > 0}
						<div class={selectedData.skills.length === 0 ? 'sm:col-span-2' : ''}>
							<h5 class="font-sans text-xs font-semibold uppercase tracking-wider text-ink-caption mb-1.5">
								Tasks
							</h5>
							<ul class="space-y-0.5">
								{#each selectedData.tasks as task}
									<li class="font-serif text-sm text-ink-secondary leading-snug">{task}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Legend -->
		<div class="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-sans text-xs text-ink-caption">
			<span class="flex items-center gap-1.5">
				<span class="inline-block w-2.5 h-2.5 rounded-full bg-ink"></span>
				Full O*NET profile
			</span>
			<span class="flex items-center gap-1.5">
				<span class="inline-block w-2.5 h-2.5 rounded-full border-2 border-ink bg-paper"></span>
				Tasks only (incomplete)
			</span>
			<span class="italic">Click a node to see details</span>
		</div>
	</div>
</div>
