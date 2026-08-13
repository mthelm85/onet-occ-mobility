<script lang="ts">
	// A small ego-graph showing what one occupation looks like in our KG.
	// Data is a curated subset of Graphic Designers' actual O*NET connections.

	interface Props {
		nRelations: number;
		nEntities: number;
	}

	let { nRelations, nEntities }: Props = $props();

	interface GraphNode {
		id: string;
		label: string;
		type: 'occupation' | 'skill' | 'knowledge' | 'ability' | 'jobzone' | 'related';
		x: number;
		y: number;
	}

	interface GraphEdge {
		source: string;
		target: string;
		relation: string;
	}

	const W = 680;
	const H = 520;
	const CX = W / 2;
	const CY = H / 2;

	// Radial positions for each group — angles in radians
	function radial(cx: number, cy: number, angle: number, r: number): [number, number] {
		return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
	}

	const R_INNER = 140;
	const R_OUTER = 220;

	// Layout: occupation center, groups fanned around it
	// Skills top-left, Knowledge top-right, Abilities bottom-right,
	// Job Zone + Related Occupations bottom-left
	const nodes: GraphNode[] = [
		// Center
		{ id: 'occ', label: 'Graphic\nDesigners', type: 'occupation', x: CX, y: CY },

		// Skills (top-left arc: ~210°–270°, i.e. -π/2 ± spread)
		{ id: 's1', label: 'Critical\nThinking', type: 'skill', ...pos(-1.85, R_OUTER) },
		{ id: 's2', label: 'Active\nListening', type: 'skill', ...pos(-2.25, R_OUTER) },
		{ id: 's3', label: 'Complex Problem\nSolving', type: 'skill', ...pos(-2.65, R_OUTER) },

		// Knowledge (top-right arc)
		{ id: 'k1', label: 'Design', type: 'knowledge', ...pos(-1.15, R_OUTER) },
		{ id: 'k2', label: 'Communications\n& Media', type: 'knowledge', ...pos(-0.75, R_OUTER) },
		{ id: 'k3', label: 'Fine Arts', type: 'knowledge', ...pos(-0.35, R_OUTER) },

		// Abilities (bottom-right arc)
		{ id: 'a1', label: 'Originality', type: 'ability', ...pos(0.25, R_OUTER) },
		{ id: 'a2', label: 'Visualization', type: 'ability', ...pos(0.65, R_OUTER) },
		{ id: 'a3', label: 'Fluency of\nIdeas', type: 'ability', ...pos(1.05, R_OUTER) },

		// Job Zone (bottom-left)
		{ id: 'jz', label: 'Job Zone 4', type: 'jobzone', ...pos(1.75, R_INNER + 20) },

		// Related occupations (far bottom-left)
		{ id: 'r1', label: 'Art\nDirectors', type: 'related', ...pos(2.35, R_OUTER) },
		{ id: 'r2', label: 'Multimedia Artists\n& Animators', type: 'related', ...pos(2.85, R_OUTER) },
	];

	function pos(angle: number, r: number): { x: number; y: number } {
		const [x, y] = radial(CX, CY, angle, r);
		return { x, y };
	}

	const edges: GraphEdge[] = [
		{ source: 'occ', target: 's1', relation: 'hasSkill' },
		{ source: 'occ', target: 's2', relation: 'hasSkill' },
		{ source: 'occ', target: 's3', relation: 'hasSkill' },
		{ source: 'occ', target: 'k1', relation: 'hasKnowledge' },
		{ source: 'occ', target: 'k2', relation: 'hasKnowledge' },
		{ source: 'occ', target: 'k3', relation: 'hasKnowledge' },
		{ source: 'occ', target: 'a1', relation: 'hasAbility' },
		{ source: 'occ', target: 'a2', relation: 'hasAbility' },
		{ source: 'occ', target: 'a3', relation: 'hasAbility' },
		{ source: 'occ', target: 'jz', relation: 'inJobZone' },
		{ source: 'occ', target: 'r1', relation: 'hasRelatedOccupation' },
		{ source: 'occ', target: 'r2', relation: 'hasRelatedOccupation' },
	];

	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	// Colors per type — muted tones that work on paper
	const typeColors: Record<string, string> = {
		occupation: 'oklch(0.45 0.14 25)',      // accent (warm red-brown)
		skill: 'oklch(0.48 0.12 250)',           // steel blue
		knowledge: 'oklch(0.50 0.13 155)',       // teal green
		ability: 'oklch(0.52 0.12 310)',         // muted purple
		jobzone: 'oklch(0.50 0.10 70)',          // warm ochre
		related: 'oklch(0.45 0.14 25)',          // same as occupation
	};

	const typeBg: Record<string, string> = {
		occupation: 'oklch(0.45 0.14 25 / 0.10)',
		skill: 'oklch(0.48 0.12 250 / 0.08)',
		knowledge: 'oklch(0.50 0.13 155 / 0.08)',
		ability: 'oklch(0.52 0.12 310 / 0.08)',
		jobzone: 'oklch(0.50 0.10 70 / 0.08)',
		related: 'oklch(0.45 0.14 25 / 0.08)',
	};

	// Edge label positions (midpoint with slight offset)
	const relationLabels: Record<string, string> = {
		hasSkill: 'hasSkill',
		hasKnowledge: 'hasKnowledge',
		hasAbility: 'hasAbility',
		inJobZone: 'inJobZone',
		hasRelatedOccupation: 'hasRelated\nOccupation',
	};

	// Group edges by relation to label only once per group
	const labelledRelations = new Set<string>();

	function shouldLabel(relation: string): boolean {
		if (labelledRelations.has(relation)) return false;
		labelledRelations.add(relation);
		return true;
	}

	// Curved edge path — slight arc for visual interest
	function edgePath(e: GraphEdge): string {
		const s = nodeMap.get(e.source)!;
		const t = nodeMap.get(e.target)!;
		const dx = t.x - s.x;
		const dy = t.y - s.y;
		// Perpendicular offset for curve
		const len = Math.sqrt(dx * dx + dy * dy);
		const nx = -dy / len;
		const ny = dx / len;
		const offset = len * 0.08;
		const mx = (s.x + t.x) / 2 + nx * offset;
		const my = (s.y + t.y) / 2 + ny * offset;
		return `M ${s.x} ${s.y} Q ${mx} ${my} ${t.x} ${t.y}`;
	}

	// Label position (along the edge)
	function labelPos(e: GraphEdge): { x: number; y: number; angle: number } {
		const s = nodeMap.get(e.source)!;
		const t = nodeMap.get(e.target)!;
		const frac = 0.38;
		const dx = t.x - s.x;
		const dy = t.y - s.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		const nx = -dy / len;
		const ny = dx / len;
		const offset = len * 0.08;
		const x = s.x + dx * frac + nx * offset * (1 - Math.abs(2 * frac - 1));
		const y = s.y + dy * frac + ny * offset * (1 - Math.abs(2 * frac - 1));
		let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
		if (angle > 90) angle -= 180;
		if (angle < -90) angle += 180;
		return { x, y, angle };
	}

	// Multi-line text helper
	function textLines(label: string): string[] {
		return label.split('\n');
	}

	// Node radius
	function nodeR(type: string): number {
		return type === 'occupation' ? 8 : 5;
	}

	// Legend
	const legend = [
		{ type: 'skill', label: 'Skill' },
		{ type: 'knowledge', label: 'Knowledge' },
		{ type: 'ability', label: 'Ability' },
		{ type: 'jobzone', label: 'Job Zone' },
		{ type: 'related', label: 'Occupation' },
	];
</script>

<figure class="mt-8 mb-4">
	<svg viewBox="0 0 {W} {H}" class="w-full max-w-2xl mx-auto" role="img" aria-label="Ego graph of Graphic Designers showing skills, knowledge, abilities, job zone, and related occupations as connected nodes">
		<!-- Edges -->
		{#each edges as e}
			{@const s = nodeMap.get(e.source)!}
			{@const t = nodeMap.get(e.target)!}
			<path
				d={edgePath(e)}
				fill="none"
				stroke={typeColors[nodeMap.get(e.target)!.type]}
				stroke-width="1.5"
				opacity="0.35"
			/>
		{/each}

		<!-- Edge labels — one per relation type -->
		{#each edges as e, i}
			{#if i === 0 || edges[i - 1].relation !== e.relation}
				{@const lp = labelPos(e)}
				<text
					x={lp.x}
					y={lp.y}
					text-anchor="middle"
					dominant-baseline="middle"
					transform="rotate({lp.angle}, {lp.x}, {lp.y})"
					font-family="var(--font-sans)"
					font-size="10.5"
					font-style="italic"
					fill={typeColors[nodeMap.get(e.target)!.type]}
					opacity="0.7"
				>
					{#each textLines(relationLabels[e.relation] ?? e.relation) as line, li}
						<tspan x={lp.x} dy={li === 0 ? 0 : 12}>{line}</tspan>
					{/each}
				</text>
			{/if}
		{/each}

		<!-- Nodes -->
		{#each nodes as node}
			{@const r = nodeR(node.type)}
			<!-- Background circle for contrast -->
			<circle cx={node.x} cy={node.y} r={r + 12} fill={typeBg[node.type]} />
			<!-- Node circle -->
			<circle
				cx={node.x}
				cy={node.y}
				r={r}
				fill={typeColors[node.type]}
				stroke="var(--color-paper)"
				stroke-width="2"
			/>
			<!-- Label -->
			{@const lines = textLines(node.label)}
			<text
				x={node.x}
				y={node.y + r + 12}
				text-anchor="middle"
				font-family="var(--font-sans)"
				font-size={node.type === 'occupation' ? '13' : '11.5'}
				font-weight={node.type === 'occupation' ? '700' : '500'}
				fill="var(--color-ink-secondary)"
			>
				{#each lines as line, li}
					<tspan x={node.x} dy={li === 0 ? 0 : 12}>{line}</tspan>
				{/each}
			</text>
		{/each}

		<!-- Legend -->
		{#each legend as item, i}
			<circle cx={22} cy={H - 70 + i * 16} r={4} fill={typeColors[item.type]} />
			<text
				x={32}
				y={H - 70 + i * 16}
				dominant-baseline="middle"
				font-family="var(--font-sans)"
				font-size="11"
				fill="var(--color-ink-caption)"
			>
				{item.label}
			</text>
		{/each}
	</svg>
	<figcaption class="mt-2 text-center font-sans text-xs text-ink-caption italic">
		Excerpt of the Graphic Designers ego graph — {nRelations} relation types connect occupations to
		skills, knowledge areas, abilities, tasks, DWAs, job zones, and other occupations. The full
		graph contains {nEntities.toLocaleString()} entities.
	</figcaption>
</figure>
