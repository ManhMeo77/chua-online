# Chùa Online

Sân chùa 3D chạy trên trình duyệt (Three.js) + server WebSocket để nhiều người thấy nhau đi lại, chat, thắp hương, đánh chuông và tích công đức.

- **Giai đoạn 1–2:** sân chùa, chú tiểu đi lại, nhiều người chơi, chat.
- **Giai đoạn 3:** thắp hương, đánh chuông, công đức & cấp tu tính ở server.
- **Giai đoạn 4:** tài khoản (giữ công đức khi đổi máy), điểm danh hằng ngày có chuỗi ngày, bảng xếp hạng.
- **Giai đoạn 5:** nhiệm vụ ngày, linh thú mở khóa theo cấp tu.
- **Giai đoạn 6:** chăm linh thú: vuốt ve, cho ăn, tâm trạng, độ thân thiết.
- **Giai đoạn 7:** chim sẻ bay; phần thưởng theo độ thân thiết (trò mới, quà công đức, khăn đỏ, hào quang, phúc lành).

## Chạy thử

Cần **Node.js 18 trở lên** (tải ở https://nodejs.org).

```bash
npm install
npm run dev
```

Mở **http://localhost:5173**. Mở thêm một tab (hoặc điện thoại cùng Wi-Fi, vào `http://<IP-máy-tính>:5173`) để thấy hai chú tiểu cùng sân.

- `npm run dev`: chạy cùng lúc Vite (giao diện, tự tải lại khi sửa code) và server game ở cổng 8787.
- `npm run build` rồi `npm start`: chế độ production, server tự phục vụ giao diện tại **http://localhost:8787**.

## Điều khiển

- **WASD / mũi tên**: đi · giữ **Shift**: chạy
- **Bấm xuống nền**: tự đi tới chỗ đó
- **Kéo chuột / vuốt**: xoay camera · **lăn chuột**: phóng to/thu nhỏ
- **Bấm vào lư hương / gác chuông** (hoặc nút bên phải): tự đi tới rồi thắp hương / đánh chuông · **E**: làm ngay khi đang đứng gần
- **Enter**: chat · **Esc**: thoát ô chat
- **Điểm danh / Linh thú / Xếp hạng / Tài khoản**: các nút trên thanh trên cùng
- **Nhiệm vụ hôm nay**: thẻ bên trái, bấm tiêu đề để thu gọn/mở
- **Chăm linh thú**: thẻ bên phải (Vuốt ve / Cho ăn), hoặc bấm thẳng vào linh thú để vuốt ve; bấm vào linh thú của người khác để vuốt ve hộ
- Đổi phòng: thêm `?phong=chua-2` vào địa chỉ

## Cấu trúc

```
index.html            khung giao diện (thanh trên, chat, màn hình vào chùa)
src/main.js           renderer, camera, điều khiển, vòng lặp, xử lý tin nhắn mạng
src/temple.js         dựng sân chùa: chính điện, lư hương + khói, cổng tam quan, cây, đèn lồng
src/landscape.js      cảnh quan sân trước và xung quanh: hồ sen, tượng Quan Âm, thủy đình, nghi môn, bảo tháp, rừng trúc, núi xa
src/statues.js        tượng dạng ảnh (Phật, Bồ Tát, Hộ Pháp): tấm ảnh tách nền luôn quay về camera
src/leaves.js         lá rụng trên sân (một InstancedMesh), hoạt ảnh rơi và bay khi bị quét
src/lookeditor.js     bảng chọn ngoại hình (màn hình vào chùa + ngăn Trang phục)
src/shared/looks.js   giới tính, kiểu áo, màu, phụ kiện, khóa theo cấp, kiểm tra hợp lệ
src/shared/chores.js  luật quét lá và tràng hạt: số lá, bán kính chổi, 108 hạt, câu niệm, công đức
src/interior.js       bên trong Chánh Điện: tượng Phật, Bồ Tát, Hộ Pháp, bàn thờ, bích họa, phướn, đèn lồng
public/textures/      ảnh vẽ cho bích họa, hào quang, tranh núi (tạo bằng ChatGPT)
src/monk.js           chú tiểu chibi ghép khối + nhãn tên + bong bóng chat (sprite canvas)
src/net.js            WebSocket client, tự nối lại
src/panels.js         hộp thoại bảng xếp hạng, tài khoản, linh thú
src/pets.js           5 linh thú ghép khối, đi theo chủ, mỗi con một dáng đi
src/audio.js          tiếng chuông, chuông gió tổng hợp bằng Web Audio (không cần file mp3)
src/shared/world.js   bố cục va chạm + điểm tương tác, dùng chung client + server
src/shared/merit.js   luật công đức, cấp tu, thời gian chờ
src/shared/quests.js  danh sách nhiệm vụ ngày, cách chọn 3 nhiệm vụ cho mỗi người
src/shared/pets.js    danh sách linh thú và cấp mở khóa
src/shared/petcare.js độ no, độ vui, tâm trạng, độ thân thiết, thời gian chờ chăm sóc
src/style.css         giao diện
server/index.js       HTTP + WebSocket /ws, phòng, tick 10 lần/giây, chống teleport, lọc chat, xử lý thắp hương/đánh chuông
server/store.js       lưu dữ liệu vào data/players.json và data/accounts.json (tự lưu mỗi 10 giây và khi tắt server)
server/accounts.js    băm mật khẩu (scrypt), kiểm tra tên đăng nhập, chống dò mật khẩu
```

## Giao thức mạng (JSON, trường `t`)

| Chiều | Tin | Nội dung |
|---|---|---|
| client → server | `hello` | `cid, name, phong` |
| | `move` | `x, z, ry, m` (m: 0 đứng, 1 đi, 2 chạy) |
| | `chat` | `text` |
| | `act` | `a: 'incense' \| 'bell' \| 'le'` (lễ chỉ làm trong Chánh Điện) |
| | `portal` | xin qua cửa sang map khác (phải đứng ở cửa) |
| | `broom` | `on` lấy chổi (phải đứng ở giá chổi) / cất chổi |
| | `bead` | `reset?` lần một hạt tràng hạt / bắt đầu lại chuỗi |
| | `pose` | `pose: 'beads' \| null` đang cầm tràng hạt |
| | `look` | `look: { g, style, color, pants, acc[] }` đổi ngoại hình (`hello` cũng có thể kèm `look`) |
| | `checkin` | điểm danh hôm nay |
| | `board` | xin bảng xếp hạng |
| | `register` / `login` | `user, pass` |
| | `pet` | `kind` hoặc `null` (cất đi) |
| | `pat` | `id?` vuốt ve linh thú của mình, hoặc của người `id` đứng gần |
| | `feed` | cho linh thú của mình ăn |
| | `trick` | `trick: 'chao' \| 'xoay' \| 'mua'` bảo linh thú làm trò đã học |
| server → client | `welcome` | `id, room, map, players[]` (chỉ người cùng map; mỗi người có `lv` = cấp tu) |
| | `mapchange` | `map, x, z, ry, players[]` bạn vừa sang map khác |
| | `me` | `merit, lv, today, cap, cd` hồ sơ riêng, `cd` = ms còn phải chờ |
| | `act` | `a, id` ai đó vừa thắp hương / đánh chuông |
| | `gain` | `a, merit` bạn vừa nhận công đức |
| | `level` / `notice` | lên cấp tu / thông báo chạy chữ |
| | `auth` | `user, cid` đăng ký/đăng nhập thành công, client lưu `cid` |
| | `rename` | `id, name, lv` người chơi đổi sang hồ sơ khác |
| | `board` | `all[], today[], me{all,today}` top 10 và hạng của bạn |
| | `quests` | `list[{id,n,goal,done}], bonus` nhiệm vụ hôm nay |
| | `pet` | `id, pet` ai đó đổi linh thú (mỗi người trong `welcome`/`join` cũng có `pet`) |
| | `unlock` | `pets[]` bạn vừa mở khóa linh thú |
| | `petact` | `id, a, by` linh thú của `id` vừa được `by` vuốt ve / cho ăn |
| | `petmood` | `id, mood` tâm trạng linh thú đổi |
| | `petnote` | `text` báo chủ khi có người vuốt ve hộ |
| | `petbond` | `id, tier` linh thú lên bậc thân thiết (mỗi người trong `welcome`/`join` có `petTier`) |
| | `petact` (trò) | `id, a: 'trick', trick, by` |
| | `me.petCare` | `full, joy, bond, mood, patCd, feedCd` của linh thú đang dắt |
| | `leaves` / `leaf` | `l: [[id, x, z]]` toàn bộ lá trên sân / lá mới rụng |
| | `swept` | `ids, by` lá vừa bị quét |
| | `broom` / `pose` | `id, on` / `id, pose` ai đó cầm chổi / tràng hạt |
| | `look` | `id, look` ai đó đổi ngoại hình (mỗi người trong `welcome`/`join` cũng có `look`) |
| | `beads` | `n, rounds, cur` số hạt hôm nay, số chuỗi tròn, hạt đang lần |
| | `join` / `leave` | người vào / ra map của bạn (`join` có `from` nếu đi từ map khác sang) |
| | `states` | `[[id,x,z,ry,m], …]` chỉ người vừa thay đổi |
| | `chat`, `count`, `error` | |

Server là bên quyết định: nó giới hạn quãng đường mỗi lần di chuyển và đẩy người chơi ra khỏi vật cản, nên client sửa code cũng không đi xuyên tường hay dịch chuyển tức thời được.

## Công đức & cấp tu

| Hành động | Công đức | Thời gian chờ | Điều kiện |
|---|---|---|---|
| Thắp hương | +5 | 60 giây / người | đứng trong 3 m quanh lư hương |
| Đánh chuông | +3 | 45 giây / người, cả phòng nghỉ 6 giây giữa hai tiếng | đứng trong 3 m quanh gác chuông |

Mỗi ngày nhận tối đa 150 công đức từ hành động (vẫn làm được, chỉ không cộng thêm). Cấp tu: Sơ tâm (0) → Phát tâm (30) → Tinh tấn (100) → Kiên định (250) → Thanh tịnh (600) → An lạc (1200). Sửa các con số này trong `src/shared/merit.js`.

Mọi kiểm tra (khoảng cách, thời gian chờ, giới hạn ngày) đều chạy ở server, nên sửa code phía trình duyệt cũng không tự cộng điểm được.

**Điểm danh** mỗi ngày một lần (theo giờ Việt Nam): ngày đầu +10, mỗi ngày liên tiếp thêm 2, tối đa +22 từ ngày thứ 7. Bỏ một ngày thì chuỗi về 1. Điểm danh không tính vào giới hạn 150/ngày.

**Bảng xếp hạng** có hai tab: *Hôm nay* (công đức nhận trong ngày, kể cả điểm danh) và *Tất cả*. Hiện top 10 và hạng của bạn, tính lại tối đa mỗi 5 giây.

## Nhiệm vụ ngày

Mỗi người nhận 3 nhiệm vụ mỗi ngày, chọn theo mã hồ sơ + ngày nên tải lại trang không đổi, và luôn có ít nhất một nghi lễ (thắp hương hoặc thỉnh chuông). Xong nhiệm vụ nào được thưởng ngay; xong cả 3 thêm **+10**. Thưởng nhiệm vụ không tính vào giới hạn 150/ngày.

| Nhiệm vụ | Thưởng |
|---|---|
| Thắp 3 nén hương | +15 |
| Thỉnh chuông 2 lần | +10 |
| Điểm danh hôm nay | +5 |
| Gửi 3 lời chào trong khu trò chuyện | +6 |
| Đi dạo 150 m quanh sân chùa | +8 |
| Đến chiêm bái trước chính điện | +6 |
| Ghé nghỉ dưới gốc đa | +6 |

Server tự đếm: quãng đường lấy từ vị trí đã kiểm tra (không tin số client gửi), "đến nơi" là đứng trong bán kính quanh điểm. Thêm nhiệm vụ mới trong `src/shared/quests.js` (khai báo `ev`, `goal`, `reward`) rồi gọi `questEvent(me, room, ev)` ở chỗ phù hợp trong server.

## Linh thú

| Linh thú | Mở khóa ở cấp | Dáng đi |
|---|---|---|
| Mèo chùa | Phát tâm | đi lắc đuôi, đứng yên thì ngó quanh |
| Chim sẻ | Tinh tấn | bay lượn ngang vai theo chủ; chủ đứng yên hơn 1 giây thì đậu lên vai; được cho ăn thì sà xuống đất |
| Thỏ trắng | Kiên định | nhảy từng bước, vểnh tai |
| Rùa vàng | Thanh tịnh | bò chậm, rướn cổ |
| Hạc trắng | An lạc | chân dài có khớp gối và bàn chân 4 ngón, bước dài, thỉnh thoảng xòe cánh |

Linh thú di chuyển có quán tính: tăng tốc, hãm dần khi tới gần, chỉ bắt đầu đi khi lệch quá 0,45 m (không nhích lên nhích xuống), quay mặt có giới hạn tốc độ và bước chân nhanh chậm theo tốc độ thật. Khi chủ quay tại chỗ, vị trí đi kèm xoay chậm theo nên linh thú không bị quăng vòng quanh. Tinh chỉnh trong `update()` / `_updateBird()` ở `src/pets.js`.

Lên cấp mở khóa linh thú mới; nếu chưa dắt con nào thì con đầu tiên tự đi theo. Đổi hoặc cất linh thú trong nút **Linh thú**. Server kiểm tra cấp trước khi cho dắt, và mọi người trong phòng đều thấy linh thú của nhau.

## Chăm linh thú

Mỗi linh thú có hai chỉ số 0–100, giảm dần theo thời gian thật (kể cả khi bạn offline):

- **Độ no**: từ no hẳn tới đói hẳn trong 12 giờ.
- **Độ vui**: từ vui hẳn tới buồn hẳn trong 6 giờ.

| Việc | Hiệu quả | Thời gian chờ |
|---|---|---|
| Vuốt ve (chủ) | +25 vui, +1 thân thiết | 20 giây |
| Vuốt ve hộ (người khác, đứng trong 3,5 m) | +12 vui cho linh thú của họ, chủ nhận lời báo | 30 giây / người |
| Cho ăn (khi độ no dưới 85) | +45 no, +3 thân thiết, +2 công đức | 2 phút |

Thức ăn chay theo từng loài: mèo ăn cơm chay, chim sẻ ăn hạt kê, thỏ ăn cà rốt, rùa ăn rau muống, hạc ăn hạt sen.

**Tâm trạng** (cả phòng đều thấy):

| Tâm trạng | Khi nào | Biểu hiện |
|---|---|---|
| Đói bụng | độ no dưới 25 | thỉnh thoảng kêu "Đói bụng…" |
| Buồn ngủ | 22 giờ – 5 giờ sáng | thu người lại, bay chữ z, đi chậm |
| Buồn, nhớ chủ | độ vui dưới 25 | cúi đầu, đi chậm, kêu "Nhớ chủ…" |
| Vui vẻ | vui từ 60 và no từ 50 | thỉnh thoảng nhảy cẫng lên |
| Bình yên | còn lại | bình thường |

**Độ thân thiết**: Mới quen (0) → Quen thân (10) → Thân thiết (30) → Tri kỷ (60), giữ riêng cho từng con khi đổi linh thú.

### Phần thưởng theo độ thân thiết

Mỗi bậc chỉ thưởng một lần cho mỗi linh thú, cả phòng nhận thông báo:

| Bậc | Quà | Trò mới | Thêm |
|---|---|---|---|
| Quen thân (10) | +10 công đức | Cúi chào | |
| Thân thiết (30) | +20 công đức | Xoay vòng | đeo khăn đỏ |
| Tri kỷ (60) | +40 công đức | Múa | hào quang trên đầu; **phúc lành**: mỗi lần thắp hương khi dắt con này được thêm +2 công đức |

Nút trò hiện trong thẻ linh thú, mỗi lần làm trò nghỉ 8 giây. Ai trong phòng cũng thấy trò, khăn và hào quang. Mỗi loài múa một kiểu: hạc xòe cánh, chim sẻ lượn vòng, thỏ vẫy tai, mèo ve vẩy đuôi. Sửa phần thưởng trong `BOND_REWARDS` và `TRICKS` ở `src/shared/petcare.js`.

Khi đang dắt linh thú, nhiệm vụ ngày có thể có thêm "Vuốt ve linh thú 3 lần" và "Cho linh thú ăn". Sửa các con số trong `src/shared/petcare.js`.

## Bản đồ: sân chùa và Chánh Điện

Game có 2 map, bố cục và va chạm nằm chung ở `src/shared/world.js` (`MAPS.san`, `MAPS.cd`):

- **Sân chùa** (`san`, `src/temple.js` + `src/landscape.js`): sân trong có chính điện, lư hương, gác chuông, bảo tháp 7 tầng, nhà Tổ và nhà khách, cây cảnh, ghế đá, luống hoa. Qua cổng tam quan là sân trước: lối đi lát đá với đèn đá, hồ sen bên trái có tượng Quan Âm trên đảo đá, hồ bên phải có cầu gỗ dẫn ra thủy đình, cuối cùng là nghi môn "AN LẠC TỰ" với hai sư tử đá. Ngoài tường là rừng trúc, thông, dãy núi xa và tranh núi non quấn quanh chân trời.
- **Chánh Điện** (`cd`, `src/interior.js`): bệ thờ 3 cấp với Tam Thế Phật (thế tay thiền định, xúc địa, cầm bát) trước 3 vầng hào quang, Bồ Tát Quan Âm và Địa Tạng hai bên, hoành phi "ĐẠI HÙNG BẢO ĐIỆN", câu đối, 6 cột sơn son thếp vàng, bích họa hai bên tường, phướn ngũ sắc, đèn lồng, bàn hương án (nến, hoa sen, mâm ngũ quả, khói nhang), bồ đoàn, Hộ Pháp hai bên cửa, trống và chuông lớn.

**Đi lại giữa hai map:** bước vào cửa giữa chính điện (hoặc bấm nút "Vào Chánh Điện") là sang map trong điện; đi ra cửa phía sau lưng để về sân. Client gửi `{t:'portal'}`, server tự kiểm tra người chơi có đứng ở cửa không rồi trả `mapchange`. Mỗi người chỉ thấy và nhận vị trí của người cùng map; chat vẫn chung cả phòng.

**Lễ Phật:** đứng ở bồ đoàn trước bàn hương án, bấm "Lễ Phật" hoặc phím E. Chú tiểu lạy 3 lạy, hào quang bừng sáng, +4 công đức, mỗi người 1 lần mỗi 60 giây. Nhiệm vụ ngày có thêm "Vào Chánh Điện chiêm bái" và "Lễ Phật trong Chánh Điện".

**Ảnh vẽ (tạo bằng ChatGPT)** đặt trong `public/textures/`:

| File | Dùng cho | Kích thước |
|---|---|---|
| `bich-hoa.jpg` | bích họa sơn mài trên tường Chánh Điện | 1536×512 |
| `hao-quang.png` | vầng hào quang sau tượng Phật (góc làm trong suốt để hòa vào tường) | 768×768 |
| `nui.jpg` | tranh núi non quanh chân trời sân chùa | 2048×683 |
| `statues/phat.webp` | Tam Thế Phật trên bệ thờ, tượng Phật nhìn qua cửa chính điện | 601×900 |
| `statues/quanam.webp` | Quan Âm trong điện và trên đảo đá giữa hồ sen | 284×900 |
| `statues/diatang.webp` | Địa Tạng Bồ Tát | 306×900 |
| `statues/hophap-thien.webp`, `statues/hophap-ac.webp` | Hộ Pháp Khuyến Thiện / Trừng Ác gác cửa Chánh Điện | ~420×900 |

**Tượng dạng ảnh** (`src/statues.js`): ChatGPT vẽ ảnh tượng thật trên phông xanh thuần, ảnh được tách nền thành trong suốt (WebP), dán lên một tấm phẳng đứng trên bệ và luôn xoay mặt về phía camera quanh trục đứng (tượng trên bàn thờ chỉ xoay trong một góc nhỏ). Tượng đổ bóng đúng hình nhờ `alphaTest`. Thiếu ảnh thì hiện tượng ghép khối như cũ. Muốn đổi tượng: tạo ảnh nền xanh mới, tách nền (ví dụ remove.bg hoặc bất kỳ công cụ chroma key nào), lưu đè file WebP cùng tên.

**Tiếng chuông** dùng file ghi âm thật `public/sounds/chuong.mp3` (cắt từ file tiếng chuông chùa ngân của tiengdong.com, bỏ đoạn lặng đầu/cuối, đổi sang mono 96 kbps cho nhẹ). Đứng càng xa gác chuông thì tiếng càng nhỏ, trầm và vang hơn. Thiếu file thì game dùng tiếng chuông tổng hợp bằng code như trước.

**Nhạc nền**: `public/sounds/nhac-nen-1.mp3`, `-2`, `-3` (nhạc thiền tịnh tâm ~55 phút, nén 64 kbps stereo, chia 3 đoạn ~9 MB để dễ tải lên GitHub). Phát bằng thẻ `<audio>` nên tải dần, không phải tải hết mới nghe; phát nối 3 đoạn rồi quay lại từ đầu. Nhạc bắt đầu sau cú bấm "Vào chùa" (trình duyệt không cho tự phát), mờ dần lên trong khoảng 1 giây, tự nhỏ đi vài giây khi chuông ngân, tạm dừng khi chuyển sang tab khác.

Bấm nút **Âm thanh** trên thanh trên cùng để mở bảng chỉnh:
- **Âm thanh**: bật/tắt toàn bộ (cả nhạc nền) + thanh âm lượng cho hiệu ứng (chuông, mõ, chổi, chuông gió; thả tay ra sẽ nghe thử).
- **Nhạc nền**: bật/tắt riêng + thanh âm lượng nhạc.

Lựa chọn được nhớ trong trình duyệt. Mặc định: hiệu ứng 80, nhạc nền bật ở mức 35.

Thiếu file nào thì game dùng hình vẽ sẵn bằng code (hoa văn, hào quang tia), riêng tranh núi thì bỏ qua (vẫn còn dãy núi 3D).

## Tạo nhân vật và Trang phục

Ở màn hình vào chùa, cạnh ô pháp danh có bảng tạo nhân vật; nhân vật phía sau đổi theo ngay, kéo chuột/ngón tay để xoay xem. Trong game, nút **Trang phục** trên thanh trên cùng mở lại bảng này (Hủy để giữ bộ cũ, Lưu để mặc). Bốn thẻ:

- **Nhân vật**: Nam (đầu cạo như chú tiểu) hoặc Nữ (tóc búi, mái thưa, tóc mai).
- **Kiểu áo**: Áo chú tiểu, Áo tràng (tay thụng, cổ chéo), Áo bà ba (cài khuy, có quần), Áo dài (cổ đứng, hai tà, có quần). **Áo nâu sồng** mở khi đạt cấp Tinh tấn, **Cà sa** mở khi đạt cấp Thanh tịnh (hai kiểu này có màu cố định).
- **Màu**: 10 màu áo, 4 màu quần (chỉ áo bà ba và áo dài lộ quần).
- **Phụ kiện**: đeo tối đa 2 món trong Chuỗi hạt đeo cổ, Chuỗi hạt cổ tay, Nón lá, Khăn vấn, Túi vải, Quạt giấy, Hoa sen cài áo (mở ở cấp Phát tâm). Nón lá và khăn vấn, hai kiểu chuỗi hạt không đeo cùng lúc.

Có nút Ngẫu nhiên và Mặc định. Lựa chọn được nhớ trong trình duyệt và lưu vào hồ sơ trên server (đăng nhập máy khác vẫn giữ). Server kiểm tra lại mọi lựa chọn (`cleanLook` trong `src/shared/looks.js`) nên không mặc được đồ chưa mở khóa. Thêm kiểu áo / màu / phụ kiện: sửa `src/shared/looks.js` rồi dựng hình trong `buildOutfit` ở `src/monk.js`.

## Luống hoa và tìm đường

Luống hoa khai báo một chỗ trong `FLOWER_BEDS` (`src/shared/world.js`): vừa dùng để vẽ hoa (mật độ đều theo diện tích, viền đá thấp), vừa là vật cản ở cả client lẫn server nên không ai đi xuyên qua được. Hai dãy luống dọc lối đi sân trong chừa 2 lối băng ngang rộng 2 m.

Bấm để đi tới (bấm nền, bấm lư hương / chuông / giá chổi, nút cửa Chánh Điện) dùng **tìm đường A\*** trên lưới 0,5 m (`findPath` trong `src/shared/world.js`), rồi rút gọn thành vài điểm rẽ, nên nhân vật tự đi vòng qua luống hoa, lư hương, cây, cột… Lưới dựng một lần cho mỗi map (~50 ms), mỗi lần tìm đường 1–8 ms.

## Quét lá và Tràng hạt

**Quét lá** (`src/leaves.js`, luật ở `src/shared/chores.js`):
- Lá rụng dần trên sân trong (nhiều nhất quanh 4 gốc đa), chung cho cả phòng: ai quét thì mọi người đều thấy lá bay đi. Phòng mới mở có sẵn 18 lá, cứ 9 giây rụng thêm một chiếc, tối đa 26 lá.
- Bấm **Quét lá** (hoặc bấm vào giá chổi cạnh nhà khách, phím E khi đứng gần) để đi tới **giá chổi** lấy chổi. Cầm chổi đi qua chỗ có lá là quét được (server tự kiểm tra trong bán kính ~1 m).
- Cứ 3 lá được +1 công đức (tính vào giới hạn ngày). Nút đổi thành **Cất chổi**, hiện số lá đã quét hôm nay và số lá còn trên sân. Vào Chánh Điện thì chổi để lại ngoài sân.
- Sân sạch lá thì cả phòng nhận thông báo tùy hỷ người quét chiếc lá cuối cùng.

**Tràng hạt**:
- Bấm **Tràng hạt** mở bảng lần chuỗi 108 hạt. Chạm vào chuỗi hạt, hoặc nhấn phím Cách / Enter, là lần một hạt. Phím Esc để đóng.
- Chọn câu niệm (Nam mô A Di Đà Phật, Quán Thế Âm Bồ Tát, Bổn Sư Thích Ca Mâu Ni Phật, Dược Sư…), bật/tắt **gõ mõ mỗi hạt** (tiếng mõ tổng hợp bằng Web Audio), **bắt đầu lại chuỗi**.
- Server đếm số câu niệm hôm nay, số chuỗi tròn hôm nay và hạt đang lần dở (giữ lại khi tải lại trang). Bấm nhanh hơn 0,2 giây/hạt thì không tính. Tròn mỗi chuỗi 108 hạt được +5 công đức.
- Khi đang mở bảng, chú tiểu cầm chuỗi hạt trên tay, cúi đầu niệm; người khác trong cùng map cũng thấy.

Nhiệm vụ ngày có thêm "Quét 12 chiếc lá trên sân" và "Lần 27 hạt tràng hạt".

## Tài khoản

- Người mới vào là **khách**: hồ sơ gắn với mã lưu trong trình duyệt.
- **Đăng ký** gắn hồ sơ khách hiện tại (giữ nguyên công đức đã có) với tên đăng nhập + mật khẩu.
- **Đăng nhập** trên máy khác sẽ chuyển sang hồ sơ của tài khoản; công đức của hồ sơ khách trên máy đó không gộp vào.
- Mật khẩu được băm bằng scrypt kèm salt, không lưu dạng chữ. Sai 8 lần trong 10 phút (theo tên đăng nhập hoặc theo IP) thì bị khóa tạm.
- Khi triển khai thật, **bắt buộc chạy qua HTTPS** (`wss://`) để mật khẩu không đi trên mạng dạng chữ. Chưa có quên mật khẩu vì game không thu email.

## Đưa lên mạng (miễn phí, có HTTPS)

Dùng **Render.com gói Free** (không cần thẻ, HTTPS tự động, WebSocket chạy được) + **Upstash Redis gói Free** để lưu công đức / tài khoản.

Giới hạn của gói Free cần biết:
- Server **ngủ sau 15 phút không có ai** (không có kết nối / tin nhắn nào). Người vào lúc server đang ngủ phải chờ ~1 phút để nó thức dậy. Có người đang chơi thì server luôn thức.
- 750 giờ chạy mỗi tháng cho cả tài khoản (đủ cho 1 server chạy liên tục cả tháng).
- Ổ đĩa bị xóa mỗi lần khởi động lại / ngủ → bắt buộc dùng Upstash để không mất dữ liệu (server tự lưu mỗi 30 giây và lưu lần cuối trước khi ngủ).

Các bước:
1. **Đưa mã lên GitHub**: tạo repo mới (ví dụ `chua-online`), tải toàn bộ thư mục dự án lên (trừ `node_modules`, `dist`, `data`).
2. **Tạo Upstash Redis**: vào console.upstash.com → Create Database (Redis, vùng Singapore) → mở database → mục **REST API** → chép `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`.
3. **Tạo dịch vụ trên Render**: đăng nhập render.com bằng GitHub → **New → Blueprint** → chọn repo → Render đọc `render.yaml` và hỏi 2 biến Upstash → dán vào → **Apply**.
4. Chờ build xong (vài phút), Render cho địa chỉ dạng `https://chua-online.onrender.com`. Mở là chơi được, nhiều người cùng vào sẽ thấy nhau.
5. Muốn dùng tên miền riêng: Render → Settings → Custom Domains (vẫn miễn phí HTTPS).

Mỗi lần sửa code và đẩy lên GitHub, Render tự build lại. Kiểm tra server: mở `/health`.

Chạy trên VPS của mình (có ổ đĩa lâu dài) thì không cần Upstash: `npm install && npm run build && npm start` sau Nginx/Caddy (nhớ bật proxy WebSocket cho `/ws`).

## Bước tiếp theo gợi ý

1. **Thêm nghi lễ**: thả hoa đăng ở hồ sen (đã có hồ), xin xăm trong Chánh Điện, tụng kinh cùng nhau theo giờ, thỉnh trống/chuông lớn trong điện, lần tràng hạt, viết lời nguyện lên bảng.
2. **Giữ chân người chơi**: phần thưởng theo độ thân thiết (linh thú học trò mới, áo cho linh thú), túi đồ và vật phẩm, nhiệm vụ tuần.
3. **Hiệu năng phòng đông**: chỉ gửi người trong bán kính ~25 m (interest management), `InstancedMesh` cho chú tiểu, tắt bóng trên máy yếu.
4. **Model đẹp hơn**: làm trong Blender, xuất `.glb` nén Draco, thay từng phần trong `temple.js`; bố cục va chạm giữ nguyên ở `shared/world.js`.
5. **Triển khai**: một VPS chạy `npm start` sau Nginx/Cloudflare (nhớ bật WebSocket), hoặc chuyển server sang Cloudflare Durable Objects.
