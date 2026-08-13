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

	// Find the main hub (most connections)
	const sortedByConn = [...connCount.entries()].sort((a, b) => b[1] - a[1]);
	const mainHub = sortedByConn[0]?.[0];

	// Seeded random for deterministic layout
	function seededRandom(seed: number): () => number {
		let s = seed;
		return () => {
			s = (s * 16807) % 2147483647;
			return (s - 1) / 2147483646;
		};
	}

	function initNodes(): Node[] {
		const nodes: Node[] = [];
		const W = 700, H = 440;
		const rand = seededRandom(42);

		// Place hub(s) and their spokes
		const hubNodes = sortedByConn.filter(([, c]) => c >= 3).map(([id]) => id);
		const isHub = new Set(hubNodes);

		// Separate hub-connected vs isolated pairs
		const hubConnected = new Set<string>();
		predictions.forEach((p) => {
			if (isHub.has(p.source)) { hubConnected.add(p.source); hubConnected.add(p.target); }
			if (isHub.has(p.target)) { hubConnected.add(p.source); hubConnected.add(p.target); }
		});

		// Place hub cluster left-center, isolated pairs right
		const cx1 = W * 0.35, cx2 = W * 0.72, cy = H * 0.5;

		for (const id of uniqueOccs) {
			const hub = isHub.has(id);
			const hasData = elemData[id] && elemData[id].skills.length > 0;
			let ix: number, iy: number;

			if (hub) {
				ix = cx1;
				iy = cy;
			} else if (hubConnected.has(id)) {
				// Spoke of the hub
				const angle = rand() * Math.PI * 2;
				const r = 100 + rand() * 40;
				ix = cx1 + Math.cos(angle) * r;
				iy = cy + Math.sin(angle) * r;
			} else {
				// Isolated pair — place on the right side
				const angle = rand() * Math.PI * 2;
				const r = 30 + rand() * 50;
				ix = cx2 + Math.cos(angle) * r;
				iy = cy + Math.sin(angle) * r;
			}

			nodes.push({ id, x: ix, y: iy, vx: 0, vy: 0, isHub: hub, hasFullData: hasData });
		}
		return nodes;
	}

	// Force simulation
	function simulate(nodes: Node[], edges: Edge[], iterations: number = 200): Node[] {
		const W = 700, H = 440;
		const repulsion = 18000;
		const attraction = 0.02;
		const damping = 0.92;
		const gravity = 0.01;
		const k = 120;

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
				node.x = Math.max(60, Math.min(W - 60, node.x));
				node.y = Math.max(40, Math.min(H - 40, node.y));
			}
		}

		return nodes;
	}

	const edges: Edge[] = predictions.map((p) => ({ source: p.source, target: p.target }));
	const layoutNodes = simulate(initNodes(), edges);

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

	$effect.pre(() => {
		selectedNode;
		if (panelEl) {
			prevPanelHeight = panelEl.offsetHeight;
		}
	});

	$effect(() => {
		selectedNode;
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

	function shortLabel(name: string): string {
		if (name.length <= 22) return name;
		return name
			.replace('First-Line Supervisors of ', 'FLS: ')
			.replace(', Investigators and Analysts', '')
			.replace(' and Prevention Specialists', '');
	}

	// Multi-line label helper — break long labels for SVG
	function labelLines(name: string): string[] {
		const short = shortLabel(name);
		if (short.length <= 18) return [short];
		// Try to break at a natural point
		const mid = Math.floor(short.length / 2);
		const spaceAfter = short.indexOf(' ', mid);
		const spaceBefore = short.lastIndexOf(' ', mid);
		const breakAt = spaceAfter !== -1 && spaceAfter - mid < mid - spaceBefore ? spaceAfter : spaceBefore;
		if (breakAt > 0) {
			return [short.slice(0, breakAt), short.slice(breakAt + 1)];
		}
		return [short];
	}
</script>

<div class="my-8">
	<div class="relative">
		<!-- SVG Graph -->
		<svg viewBox="0 0 700 440" class="w-full select-none" role="img" aria-label="Graph of compelling TuckER predictions showing occupation connections">
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
				{@const lines = labelLines(node.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<g
					class="cursor-pointer"
					onclick={() => selectNode(node.id)}
					role="button"
					tabindex="0"
				>
					{#if isSelected}
						<circle cx={node.x} cy={node.y} r={node.isHub ? 18 : 13} fill="var(--color-accent)" opacity="0.15" />
					{/if}
					<circle
						cx={node.x}
						cy={node.y}
						r={node.isHub ? 12 : 8}
						fill={isSelected ? 'var(--color-accent)' : 'var(--color-ink)'}
						stroke={isSelected ? 'var(--color-accent)' : 'var(--color-ink)'}
						stroke-width="0"
						class="transition-all duration-150"
					/>
					{#each lines as line, li}
						<text
							x={node.x}
							y={node.y + (node.isHub ? 22 : 17) + li * 13}
							text-anchor="middle"
							font-size={node.isHub ? '11' : '10'}
							font-family="var(--font-serif)"
							fill={isSelected ? 'var(--color-accent)' : 'var(--color-ink)'}
							font-weight={isSelected ? '700' : node.isHub ? '600' : '400'}
							class="transition-all duration-150"
						>
							{line}
						</text>
					{/each}
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
						This occupation is missing skill, knowledge, and ability ratings in O*NET — only task data is available.
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
			<span class="italic">Click a node to see its O*NET profile</span>
		</div>
	</div>
</div>
