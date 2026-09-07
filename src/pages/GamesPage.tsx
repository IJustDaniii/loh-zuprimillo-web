import { BarChart3, Dice5, Plus, Swords, Trophy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, postJson } from "../lib/api";
import { compactNumber, levelForXp } from "../lib/format";
import { Modal } from "../components/Modal";
import { PollCreator } from "../components/PollCreator";
import { Avatar } from "../components/Avatar";
import { useApp } from "../context/AppContext";

export function GamesPage() {
  const { data: app } = useApp();
  const [games, setGames] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [pollModal, setPollModal] = useState(false);
  const [triviaResult, setTriviaResult] = useState<any>(null);
  const load = async () => {
    const [g, p] = await Promise.all([
      api<any>("/api/games"),
      api<{ data: any[] }>("/api/polls"),
    ]);
    setGames(g);
    setPolls(p.data);
  };
  useEffect(() => {
    void load();
  }, []);
  const answerTrivia = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTriviaResult(
      await postJson(`/api/games/trivia/${games.trivia.id}`, {
        answer: new FormData(event.currentTarget).get("answer"),
      }),
    );
  };
  if (!games) return <div className="loading">Preparando el circo…</div>;
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">COMPETICIÓN ABSURDA</p>
          <h1>Juegos y rankings</h1>
        </div>
        <button className="button primary" onClick={() => setPollModal(true)}>
          <Plus /> Encuesta
        </button>
      </header>
      <section className="game-grid">
        <article className="game-card random-clip">
          <header>
            <Dice5 />
            <span>
              <small>CLIP ALEATORIO</small>
              <strong>La ruleta del archivo</strong>
            </span>
          </header>
          {games.clip ? (
            <>
              <Link to={`/post/${games.clip.id}`}>
                <h2>{games.clip.title}</h2>
              </Link>
              {games.clip.kind === "VIDEO" ? (
                <video
                  src={`/api/media/${games.clip.media_id}`}
                  controls
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                  className="protected-media"
                />
              ) : games.clip.kind === "AUDIO" ? (
                <audio
                  src={`/api/media/${games.clip.media_id}`}
                  controls
                  controlsList="nodownload"
                  className="protected-media"
                />
              ) : (
                <img
                  src={`/api/media/${games.clip.media_id}`}
                  draggable={false}
                  className="protected-media"
                />
              )}
            </>
          ) : (
            <p>Subid algún clip y volveremos a girar.</p>
          )}
        </article>
        <article className="game-card trivia-card">
          <header>
            <BarChart3 />
            <span>
              <small>
                {games.trivia?.kind === "WHO_SAID"
                  ? "QUIÉN DIJO ESTO"
                  : "DE QUÉ AÑO ES"}
              </small>
              <strong>Interrogatorio oficial</strong>
            </span>
          </header>
          {games.trivia ? (
            <form onSubmit={answerTrivia}>
              <h2>{games.trivia.prompt}</h2>
              {games.trivia.options.map((option: string) => (
                <label className="quiz-option" key={option}>
                  <input type="radio" name="answer" value={option} required />
                  {option}
                </label>
              ))}
              <button className="button full">Comprobar</button>
              {triviaResult && (
                <p className={triviaResult.correct ? "correct" : "wrong"}>
                  {triviaResult.correct
                    ? "✓ Correcto. +5 XP"
                    : `Nope. Era: ${triviaResult.answer}`}
                </p>
              )}
            </form>
          ) : (
            <p>Dani aún no ha preparado preguntas.</p>
          )}
        </article>
      </section>
      <section className="section-block">
        <header>
          <div>
            <p className="eyebrow">DEMOCRACIA RELATIVA</p>
            <h2>Encuestas</h2>
          </div>
        </header>
        <div className="poll-grid">
          {polls.map((poll) => (
            <article className="poll-card" key={poll.id}>
              <h3>{poll.question}</h3>
              <small>por {poll.creator_name}</small>
              {poll.options.map((option: any) => {
                const total = poll.options.reduce(
                  (sum: number, o: any) => sum + Number(o.votes),
                  0,
                );
                const pct = total
                  ? Math.round((Number(option.votes) / total) * 100)
                  : 0;
                return (
                  <button
                    key={option.id}
                    className={option.mine ? "chosen" : ""}
                    onClick={async () => {
                      await postJson(`/api/polls/${poll.id}/votes`, {
                        optionId: option.id,
                      });
                      await load();
                    }}
                  >
                    <span>
                      {option.label}
                      <b>{pct}%</b>
                    </span>
                    <i style={{ width: `${pct}%` }} />
                  </button>
                );
              })}
            </article>
          ))}
        </div>
      </section>
      <section className="section-block">
        <p className="eyebrow">TABLA NO OFICIAL</p>
        <h2>
          <Trophy /> Ranking de XP
        </h2>
        <div className="ranking">
          {games.ranking.map((member: any, index: number) => (
            <Link key={member.id} to={`/perfil/${member.handle}`}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <Avatar
                member={{
                  displayName: member.display_name,
                  avatarMediaId: member.avatar_media_id,
                }}
                size="sm"
              />
              <span>
                <strong>{member.display_name}</strong>
                <small>Nivel {levelForXp(member.xp)}</small>
              </span>
              <em>{compactNumber(member.xp)} XP</em>
            </Link>
          ))}
        </div>
      </section>
      {games.battles.length > 0 && (
        <section className="section-block">
          <h2>
            <Swords /> Batallas de clips
          </h2>
          {games.battles.map((battle: any) => (
            <article className="battle" key={battle.id}>
              <h3>{battle.title}</h3>
              <div>
                <button
                  onClick={async () => {
                    await postJson(`/api/games/battles/${battle.id}`, {
                      postId: battle.left_post_id,
                    });
                    await load();
                  }}
                >
                  {battle.left_title}
                  <b>{battle.left_votes}</b>
                </button>
                <span>VS</span>
                <button
                  onClick={async () => {
                    await postJson(`/api/games/battles/${battle.id}`, {
                      postId: battle.right_post_id,
                    });
                    await load();
                  }}
                >
                  {battle.right_title}
                  <b>{battle.right_votes}</b>
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {(games.achievements.length > 0 || games.awards.length > 0) && (
        <section className="section-block">
          <h2>Vitrina colectiva</h2>
          <div className="achievement-row">
            {games.achievements.map((a: any) => (
              <div key={a.id}>
                <span>{a.icon}</span>
                <strong>{a.title}</strong>
                <small>{a.description}</small>
              </div>
            ))}
          </div>
          {games.awards.map((a: any) => (
            <p key={a.id}>
              {a.icon}{" "}
              <strong>
                {a.title} {a.year}
              </strong>{" "}
              — {a.winners || "por decidir"}
            </p>
          ))}
        </section>
      )}
      {pollModal && (
        <Modal title="Nueva encuesta" onClose={() => setPollModal(false)}>
          <PollCreator
            onDone={() => {
              setPollModal(false);
              void load();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
