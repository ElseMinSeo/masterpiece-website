-- 자동 생성 파일: npm run db:seed:gen (원본 lib/data/places.ts). 개발용 가상 데이터.
insert into public.places (id, name, category, cuisine, district, station, address, price_min, price_max,
  noise_level, seating, hours_text, checked_at, published) values
  ('dev-001', '모래정원 키친', 'restaurant', 'western', '성수동', '성수', '서울 성동구 가상로 101 (개발용 주소)', 18000, 32000, 'moderate', '2인 테이블 8개', '11:30 ~ 21:30 (15~17시 브레이크)', '2026-11-20', true),
  ('dev-002', '느린오후 커피', 'cafe', 'etc', '성수동', '뚝섬', '서울 성동구 가상로 22 (개발용 주소)', 6000, 12000, 'quiet', '2~4인석 12개', '10:00 ~ 22:00', '2026-11-20', true),
  ('dev-003', '소담 한상', 'restaurant', 'korean', '서울숲', '서울숲', '서울 성동구 가상숲길 7 (개발용 주소)', 15000, 25000, 'quiet', '2인 좌식·입식 혼합', '11:00 ~ 21:00', '2026-11-20', true),
  ('dev-004', '스시 하루', 'restaurant', 'japanese', '성수동', '성수', '서울 성동구 가상로 55 (개발용 주소)', 30000, 60000, 'quiet', '바 좌석 10석', '12:00 ~ 22:00 (15~18시 브레이크)', '2026-11-20', true),
  ('dev-005', '홍등 반점', 'restaurant', 'chinese', '왕십리', '왕십리', '서울 성동구 가상대로 300 (개발용 주소)', 12000, 28000, 'lively', '4인 테이블 위주', '11:30 ~ 22:00', '2026-11-20', true),
  ('dev-006', '라운지 미드나잇', 'bar', 'etc', '건대입구', '건대입구', '서울 광진구 가상로 88 (개발용 주소)', 14000, 22000, 'moderate', '바 좌석·2인 소파석', '18:00 ~ 01:00', '2026-11-20', true),
  ('dev-007', '테라스 1987', 'mood', 'western', '서울숲', '서울숲', '서울 성동구 가상숲길 19 (개발용 주소)', 16000, 26000, 'moderate', '실내 2인석·테라스 6석', '09:00 ~ 20:00', '2026-11-20', true),
  ('dev-008', '다이닝 결', 'fine', 'western', '성수동', '뚝섬', '서울 성동구 가상로 140 (개발용 주소)', 65000, 95000, 'quiet', '2인 룸 3개', '18:00 ~ 22:00 (예약제)', '2026-11-20', true)
on conflict (id) do nothing;

insert into public.cohorts (code, region, start_at, end_at, status)
values ('pilot-1', '성수 생활권 (개발용)', now(), now() + interval '56 days', 'open')
on conflict (code) do nothing;
