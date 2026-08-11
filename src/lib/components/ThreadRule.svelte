<script lang="ts">
	interface Props {
		align?: 'left' | 'right';
	}

	let { align = 'right' }: Props = $props();

	const W = 500;
	const H = 32;
	const cy = H / 2;
	const lineY = cy;

	// The main rule line starts after the graph fragment
	const ruleStart = 0.18; // where the straight line begins (fraction of W)

	// Node positions in the graph fragment region (x as fraction of ruleStart * W)
	// Small network: a hub with a few spokes that funnel into the line
	const nodes = [
		{ x: 0.05, y: 0.28 },  // dangling leaf (top-left)
		{ x: 0.15, y: 0.72 },  // dangling leaf (bottom-left)
		{ x: 0.30, y: 0.35 },  // hub 1
		{ x: 0.52, y: 0.62 },  // hub 2
		{ x: 0.72, y: 0.40 },  // merge node
		{ x: 0.38, y: 0.15 },  // top leaf off hub 1
	].map((n) => ({
		x: n.x * ruleStart * W,
		y: n.y * H,
	}));

	// Edges: pairs of node indices
	const edges = [
		[0, 2], // leaf → hub 1
		[1, 3], // leaf → hub 2
		[5, 2], // top leaf → hub 1
		[2, 4], // hub 1 → merge
		[3, 4], // hub 2 → merge
	];

	const nodeRadius = 1.8;

	// Build curved edges using quadratic Bézier for organic feel
	function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
		// Control point offset perpendicular to the edge midpoint
		const mx = (a.x + b.x) / 2;
		const my = (a.y + b.y) / 2;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		// Slight curve — perpendicular offset proportional to length
		const off = len * 0.15;
		const cx = mx + (-dy / len) * off;
		const cy = my + (dx / len) * off;
		return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
	}

	// Transition edge: merge node curves into the rule line
	const mergeNode = nodes[4];
	const ruleX = ruleStart * W;
	const transitionPath = `M${mergeNode.x.toFixed(1)},${mergeNode.y.toFixed(1)} Q${((mergeNode.x + ruleX) / 2).toFixed(1)},${lineY.toFixed(1)} ${ruleX.toFixed(1)},${lineY.toFixed(1)}`;
</script>

<div class={align === 'right' ? 'w-3/5 ml-auto' : 'w-3/5 mr-auto'}>
	<svg
		viewBox="0 0 {W} {H}"
		class="w-full"
		style={align === 'left' ? 'transform: scaleX(-1)' : ''}
		preserveAspectRatio="xMaxYMid meet"
		role="separator"
	>
		<!-- Fade gradient for the rule line trailing edge -->
		<defs>
			<linearGradient id="rule-fade" x1={ruleX} y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
				<stop offset="0%" stop-color="var(--color-rule)" stop-opacity="1" />
				<stop offset="70%" stop-color="var(--color-rule)" stop-opacity="1" />
				<stop offset="100%" stop-color="var(--color-rule)" stop-opacity="0" />
			</linearGradient>
		</defs>

		<!-- Graph fragment edges -->
		{#each edges as [ai, bi]}
			<path
				d={edgePath(nodes[ai], nodes[bi])}
				fill="none"
				stroke="var(--color-rule)"
				stroke-width="0.6"
				stroke-linecap="round"
			/>
		{/each}

		<!-- Transition from merge node into rule line -->
		<path
			d={transitionPath}
			fill="none"
			stroke="var(--color-rule)"
			stroke-width="0.6"
			stroke-linecap="round"
		/>

		<!-- Main rule line (fades at trailing edge, 1px to match full-width separator) -->
		<line
			x1={ruleX}
			y1={lineY}
			x2={W}
			y2={lineY}
			stroke="url(#rule-fade)"
			stroke-width="1"
			vector-effect="non-scaling-stroke"
			stroke-linecap="round"
		/>

		<!-- Nodes -->
		{#each nodes as node}
			<circle
				cx={node.x}
				cy={node.y}
				r={nodeRadius}
				fill="var(--color-rule)"
			/>
		{/each}
	</svg>
</div>
