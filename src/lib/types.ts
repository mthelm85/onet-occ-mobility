export interface Results {
	meta: Meta;
	model_config: ModelConfig;
	training_history: TrainingHistory;
	test_metrics: TestMetrics;
	tucker_predictions: TuckerPrediction[];
	baselines: Baselines;
	overlap: OverlapSummary;
}

export interface Meta {
	generated: string;
	onet_version: string;
	n_entities: number;
	n_relations: number;
	n_occupations: number;
	n_train_triples: number;
	n_valid_triples: number;
	n_test_triples: number;
}

export interface ModelConfig {
	d_e: number;
	d_r: number;
	input_dropout: number;
	hidden_dropout1: number;
	hidden_dropout2: number;
	batch_size: number;
	epochs_max: number;
	epochs_actual: number;
	lr_initial: number;
	lr_decay: number;
	label_smoothing: number;
	patience: number;
	loss_function: string;
	optimizer: string;
}

export interface TrainingHistory {
	losses: number[];
	val_mrr: number[];
}

export interface TestMetrics {
	mrr: number;
	mrr_ci: [number, number];
	hits_at_1: number;
	hits_at_1_ci: [number, number];
	hits_at_3: number;
	hits_at_3_ci: [number, number];
	hits_at_10: number;
	hits_at_10_ci: [number, number];
	mean_rank: number;
}

export interface PredictionOverlap {
	shared_skills: number;
	shared_knowledge: number;
	shared_abilities: number;
	shared_tasks: number;
	shared_dwas: number;
	same_jobzone: boolean;
	jaccard: number;
	already_linked: boolean;
}

export interface TuckerPrediction {
	source: string;
	target: string;
	source_idx: number;
	target_idx: number;
	raw_score: number;
	probability: number;
	percentile: number;
	overlap: PredictionOverlap;
}

export interface BaselinePrediction {
	source: string;
	target: string;
	source_idx: number;
	target_idx: number;
	score: number;
}

export interface Baseline {
	name: string;
	method: string;
	top: BaselinePrediction[];
}

export interface Baselines {
	jaccard: Baseline;
	binary_cosine: Baseline;
	text_embedding: Baseline;
}

export interface OverlapSummary {
	tucker_n: number;
	baseline_n: number;
	tucker_vs_jaccard: number;
	tucker_vs_binary_cosine: number;
	tucker_vs_text_embedding: number;
	jaccard_vs_binary_cosine: number;
	jaccard_vs_text_embedding: number;
	binary_cosine_vs_text_embedding: number;
}
