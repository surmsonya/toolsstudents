"use client";

import { useEffect, useState } from "react";

/*
 * Белый экран загрузки главной: набирается пин-код, каждая цифра через
 * мгновение прячется за точку. Экран уходит, только когда код допечатан
 * и 3D-модель загрузилась; если модель ещё грузится, набор повторяется.
 * Показывается раз за сессию вкладки.
 */

const CODE = ["0", "3", "1", "2"];
const STORAGE_KEY = "pin-loader-seen";

// Шаг набора: цифра появляется, а предыдущая в этот момент прячется.
const TYPE_STEP_MS = 320;
// Пауза после последней цифры, прежде чем она тоже станет точкой.
const LAST_MASK_MS = 380;
// Сколько держим полностью набранный код перед уходом или повтором.
const HOLD_MS = 420;
// Должно совпадать с transition у .pin-loader в globals.css.
const FADE_MS = 700;
// Если событие load так и не пришло (ошибка сети, скрипт не загрузился),
// не держим посетителя на белом экране дольше этого.
const MODEL_TIMEOUT_MS = 12000;

// Ставится до гидрации, чтобы при повторном заходе экран не мигнул.
export const pinLoaderSeenScript = `try{if(sessionStorage.getItem("${STORAGE_KEY}"))document.documentElement.dataset.pinSeen="1"}catch(e){}`;

type Phase = "playing" | "leaving" | "done";

function markSeen() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Приватный режим или запрет хранилища: просто покажем экран снова.
  }
  document.documentElement.dataset.pinSeen = "1";
}

function hasSeen() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function PinLoader() {
  const [phase, setPhase] = useState<Phase>("playing");
  // typed — сколько цифр уже набрано, masked — сколько из них стали точками.
  const [typed, setTyped] = useState(0);
  const [masked, setMasked] = useState(0);

  useEffect(() => {
    // Уже видели: экран скрыт через html[data-pin-seen], который остаётся
    // на документе и при переходах внутри сайта.
    if (hasSeen()) {
      return;
    }

    let cancelled = false;
    let modelReady = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(() => !cancelled && fn(), ms));
    };

    const model = document.querySelector<HTMLElement & { loaded?: boolean }>(
      ".catalog-model",
    );
    const onReady = () => {
      modelReady = true;
    };
    if (!model || model.loaded) {
      modelReady = true;
    } else {
      model.addEventListener("load", onReady, { once: true });
      model.addEventListener("error", onReady, { once: true });
    }
    later(onReady, MODEL_TIMEOUT_MS);

    const runCycle = () => {
      CODE.forEach((_, index) => {
        later(() => {
          setTyped(index + 1);
          setMasked(index);
        }, TYPE_STEP_MS * (index + 1));
      });

      const typedAt = TYPE_STEP_MS * CODE.length;
      later(() => setMasked(CODE.length), typedAt + LAST_MASK_MS);

      later(() => {
        // Событие load можно пропустить (модель из кэша успевает раньше
        // эффекта или элемент пересоздаётся), поэтому спрашиваем и напрямую.
        const current = document.querySelector<
          HTMLElement & { loaded?: boolean }
        >(".catalog-model");
        if (current?.loaded) {
          modelReady = true;
        }
        if (!modelReady) {
          setTyped(0);
          setMasked(0);
          runCycle();
          return;
        }
        // Отметку ставим после затухания: html[data-pin-seen] сразу
        // прячет экран через display: none и оборвал бы transition.
        setPhase("leaving");
        later(() => {
          markSeen();
          setPhase("done");
        }, FADE_MS);
      }, typedAt + LAST_MASK_MS + HOLD_MS);
    };

    runCycle();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      model?.removeEventListener("load", onReady);
      model?.removeEventListener("error", onReady);
    };
  }, []);

  if (phase === "done") {
    return null;
  }

  return (
    <div
      className={`pin-loader${phase === "leaving" ? " is-leaving" : ""}`}
      role="status"
      aria-label="Загрузка"
    >
      <div className="pin-loader-code" aria-hidden="true">
        {CODE.map((digit, index) => {
          const state =
            index < masked ? "masked" : index < typed ? "typed" : "empty";
          return (
            <span className={`pin-loader-slot is-${state}`} key={index}>
              <span className="pin-loader-digit">{digit}</span>
              <span className="pin-loader-dot" />
            </span>
          );
        })}
      </div>
    </div>
  );
}
