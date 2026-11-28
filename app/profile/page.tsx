"use client";

import Link from "next/link";
import { useState } from "react";
import { BookmarkIcon, CalendarIcon, FlameIcon, UserIcon } from "@/components/icons";
import { Button, DevBadge, LinkButton, StatusBadge, TopBar } from "@/components/ui";
import { TextInput } from "@/components/form";
import { STATUS_LABEL, useActiveApplication, useApp } from "@/lib/store";

const VERIFICATION_LABEL = { unverified: "본인확인 전", pending: "확인 중", verified: "확인 완료" } as const;

export default function ProfilePage() {
  const { ready, mode, user, verification, profile, bookmarks, draft, updateNickname, resetDemo } = useApp();
  const active = useActiveApplication();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const save = async () => {
    try {
      await updateNickname(name);
      setEditing(false);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장하지 못했어요.");
    }
  };

  return (
    <main>
      <TopBar title="프로필" back="/home" />
      <div className="space-y-4 px-5 pt-4">
        <section className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-field text-muted"><UserIcon className="size-8" /></span>
          {editing ? (
            <div className="min-w-0 flex-1">
              <TextInput id="nickname" label="닉네임" value={name} onChange={setName} maxLength={12} invalid={!!err} />
              {err && <p role="alert" className="mt-1 text-[13px] text-red-600">{err}</p>}
              <div className="mt-2 flex gap-2">
                <Button className="min-h-10 flex-1 text-[14px]" onClick={save}>저장</Button>
                <Button variant="outline" className="min-h-10 flex-1 text-[14px]" onClick={() => { setEditing(false); setErr(""); }}>취소</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[20px] font-semibold" data-testid="nickname">{ready ? profile.nickname : "…"}</p>
                {mode === "supabase"
                  ? <p className="truncate text-[13px] text-muted" data-testid="profile-email">{user?.email}</p>
                  : <DevBadge>가상 사용자</DevBadge>}
              </div>
              <button type="button" onClick={() => { setName(profile.nickname); setEditing(true); }}
                className="min-h-10 shrink-0 rounded-lg border border-line bg-white px-3 text-[13px]">
                프로필 수정
              </button>
            </>
          )}
        </section>

        <section className="brand-gradient rounded-2xl p-5 text-white">
          <h2 className="flex items-center gap-1.5 text-[21px] font-bold"><FlameIcon filled /> 데이트가 필요한 순간</h2>
          <p className="mt-2 text-[14px] leading-relaxed opacity-95">
            내 취향과 비슷한 파트너를 찾고 계신가요?<br />신청서를 작성하면 운영자가 직접 확인해 소개해드려요.
          </p>
          {active ? (
            <LinkButton href="/appointments" variant="white" className="mt-4">신청 상태 보기 · {STATUS_LABEL[active.status]}</LinkButton>
          ) : (
            <LinkButton href="/apply" variant="white" className="mt-4">{draft ? "작성 중인 신청 이어서 하기" : "매칭 신청하기"}</LinkButton>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link href="/saved" className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white py-5">
            <BookmarkIcon className="text-brand" />
            <span className="text-[15px]">저장한 장소 <strong data-testid="profile-saved-count">{ready ? bookmarks.length : "-"}</strong></span>
          </Link>
          <Link href="/appointments" className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-5 text-center">
            <CalendarIcon className="text-brand" />
            <span className="text-[15px]">{active ? STATUS_LABEL[active.status] : draft ? "신청서 작성 중" : "신청 내역 없음"}</span>
          </Link>
        </section>

        <section className="rounded-2xl border border-line bg-white p-4" aria-labelledby="verify-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="verify-title" className="text-[15px] font-semibold">성인·본인확인</h2>
            <StatusBadge>
              <span data-testid="verification-status">{VERIFICATION_LABEL[verification]}</span>
            </StatusBadge>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            소개는 본인확인을 마친 분께만 보내드려요. 본인확인은 확인 업체 계약 후 제공돼요.
          </p>
        </section>

        {mode === "supabase" ? (
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" block className="min-h-11 text-[15px]">로그아웃</Button>
          </form>
        ) : (
          <section className="rounded-2xl border border-dashed border-line p-4">
            <p className="text-[14px] font-semibold">개발용 도구</p>
            <p className="mt-1 text-[13px] text-muted">이 기기의 브라우저에 저장된 데모 데이터(저장 목록·신청서·신청 내역)를 모두 지워요.</p>
            <Button variant="outline" className="mt-3 min-h-10 text-[14px]" onClick={() => {
              if (window.confirm("데모 데이터를 모두 지울까요?")) void resetDemo();
            }}>데모 데이터 초기화</Button>
          </section>
        )}
      </div>
    </main>
  );
}
