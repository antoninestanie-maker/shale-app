// Smoke test STT : cargo run --example transcribe -- <model.bin> <audio.wav>
// Le wav doit être en 16 kHz mono 16 bits (généré par ex. avec
// `say -o test.wav --data-format=LEI16@16000 "..."`).
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (model, wav) = (&args[1], &args[2]);

    let reader = hound::WavReader::open(wav).expect("lecture wav");
    let spec = reader.spec();
    assert_eq!(spec.sample_rate, 16_000, "wav doit être en 16 kHz");
    let audio: Vec<f32> = reader
        .into_samples::<i16>()
        .map(|s| s.expect("échantillon") as f32 / 32768.0)
        .collect();

    let ctx = WhisperContext::new_with_params(model, WhisperContextParameters::default())
        .expect("chargement modèle");
    let mut state = ctx.create_state().expect("état");
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("fr"));
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_special(false);

    let t0 = std::time::Instant::now();
    state.full(params, &audio).expect("transcription");
    let n = state.full_n_segments();
    let mut text = String::new();
    for i in 0..n {
        if let Some(seg) = state.get_segment(i) {
            if let Ok(s) = seg.to_str_lossy() {
                text.push_str(&s);
            }
        }
    }
    println!("TRANSCRIPTION: {}", text.trim());
    println!("DURÉE: {:?}", t0.elapsed());
}
