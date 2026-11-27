export type BuiltinFolderId =
  | 'all'
  | 'reading'
  | 'favorites'
  | 'van_hoc'
  | 'truyen_tranh'
  | 'ky_nang';

export type FolderId = BuiltinFolderId | (string & {});

export type LibraryViewMode =
  | 'coverflow'
  | 'ring'
  | 'cascade'
  | 'sphere'
  | 'fandeck'
  | 'spotlight'
  | 'bookshelf'
  | 'grid';

export type PageTurnMode = 'curl' | 'fade' | 'slide' | 'instant';
export type ReaderTheme = 'sepia' | 'paper' | 'slate' | 'midnight' | 'matcha';
export type ScreenRotation = 0 | 90 | 180 | 270;
export type LibrarySortMode =
  | 'default'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'progress_desc'
  | 'pages_desc'
  | 'pages_asc'
  | 'format'
  | 'favorite';

export interface BookPage {
  chapter: string;
  heading?: string;
  paragraphs?: string[];
  imageUrl?: string;
  comicScene?: {
    panelTitle: string;
    caption: string;
    dialogue: { speaker: string; text: string }[];
    palette: [string, string, string];
    mood: 'rain' | 'forest' | 'sky' | 'autumn';
    sceneVariant: number;
  };
}

export interface PdfMetaDetails {
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  version?: string;
}

export interface PdfOutlineItem {
  title: string;
  pageIdx: number;
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  folderId: string;
  folderName: string;
  filePath: string;
  format: 'EPUB' | 'CBZ' | 'PDF' | 'TXT';
  coverImage?: string;
  fallbackStyle: {
    bg: string;
    accent: string;
    motif: 'river' | 'crimson' | 'sky' | 'autumn' | 'zen';
  };
  ambientColor: string;
  synopsis: string;
  totalPages: number;
  currentPage: number;
  hasOpened?: boolean;
  lastOpenedAt?: number;
  readingSeconds?: number;
  favorite: boolean;
  bookmarks: number[];
  pages: BookPage[];
  needsPdfMeta?: boolean;
  fileSize?: number;
  chapterCount?: number;
  wordCount?: number;
  charCount?: number;
  pdfMeta?: PdfMetaDetails;
  pdfChapters?: PdfOutlineItem[];
}

export interface AppSettings {
  sfxEnabled: boolean;
  sfxVolume: number;
  showHints: boolean;
  sortBy: LibrarySortMode;
  pageTurnMode: PageTurnMode;
  readerTheme: ReaderTheme;
  fontSize: number;
  lineHeight: number;
  brightness: number;
  warmth: number;
  twoPageSpread: boolean;
  rotation: ScreenRotation;
  fontFamily: 'serif' | 'sans';
}

export const FOLDER_TABS: { id: FolderId; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'reading', label: 'Đang đọc' },
  { id: 'favorites', label: '★ Yêu thích' },
  { id: 'van_hoc', label: 'Sách Văn Học' },
  { id: 'truyen_tranh', label: 'Truyện Tranh' },
  { id: 'ky_nang', label: 'Kỹ Năng & Lịch Sử' },
];

export const LIBRARY_VIEW_MODES: { id: LibraryViewMode; label: string; short: string }[] = [
  { id: 'coverflow', label: '3D Cánh Quạt', short: 'Cánh Quạt' },
  { id: 'ring', label: '3D Vòng Tròn', short: 'Vòng Tròn' },
  { id: 'cascade', label: '3D Xếp Lớp', short: 'Xếp Lớp' },
  { id: 'sphere', label: '3D Quả Cầu', short: 'Quả Cầu' },
  { id: 'fandeck', label: '3D Xòe Bài', short: 'Xòe Bài' },
  { id: 'spotlight', label: '3D Tiêu Điểm', short: 'Tiêu Điểm' },
  { id: 'bookshelf', label: 'Kệ Sách', short: 'Kệ Sách' },
  { id: 'grid', label: 'Lưới Thẻ', short: 'Lưới' },
];

export const LIBRARY_SORT_MODES: { id: LibrarySortMode; label: string; short: string }[] = [
  { id: 'default', label: 'Mặc định (Thứ tự thư mục)', short: 'Mặc định' },
  { id: 'title_asc', label: 'Tên sách (A → Z)', short: 'Tên A–Z' },
  { id: 'title_desc', label: 'Tên sách (Z → A)', short: 'Tên Z–A' },
  { id: 'author_asc', label: 'Tác giả (A → Z)', short: 'Tác giả' },
  { id: 'progress_desc', label: 'Tiến trình đọc (Nhiều → Ít)', short: 'Đang đọc %' },
  { id: 'pages_desc', label: 'Số lượng trang (Dài → Ngắn)', short: 'Nhiều trang' },
  { id: 'pages_asc', label: 'Số lượng trang (Ngắn → Dài)', short: 'Ít trang' },
  { id: 'format', label: 'Loại sách (EPUB / CBZ / PDF)', short: 'Loại file' },
  { id: 'favorite', label: 'Yêu thích lên đầu', short: '★ Yêu thích' },
];

export const INITIAL_SETTINGS: AppSettings = {
  sfxEnabled: true,
  sfxVolume: 0.7,
  showHints: true,
  sortBy: 'default',
  pageTurnMode: 'curl',
  readerTheme: 'sepia',
  fontSize: 16,
  lineHeight: 1.65,
  brightness: 100,
  warmth: 12,
  twoPageSpread: true,
  rotation: 0,
  fontFamily: 'serif',
};

function makeProseBook(raw: Omit<BookItem, 'totalPages'>): BookItem {
  let charCount = 0;
  let wordCount = 0;
  const chapters = new Set<string>();
  for (const p of raw.pages) {
    if (p.chapter) chapters.add(p.chapter);
    if (p.heading) {
      charCount += p.heading.length;
      wordCount += p.heading.trim().split(/\s+/).filter(Boolean).length;
    }
    if (p.paragraphs) {
      for (const para of p.paragraphs) {
        charCount += para.length;
        wordCount += para.trim().split(/\s+/).filter(Boolean).length;
      }
    }
    if (p.comicScene) {
      const parts = [
        p.comicScene.panelTitle,
        p.comicScene.caption,
        ...p.comicScene.dialogue.map((d) => `${d.speaker} ${d.text}`),
      ];
      for (const part of parts) {
        charCount += part.length;
        wordCount += part.trim().split(/\s+/).filter(Boolean).length;
      }
    }
  }
  const estimatedBytes =
    raw.format === 'CBZ'
      ? raw.pages.length * 640 * 1024
      : raw.format === 'PDF'
        ? Math.max(120 * 1024, raw.pages.length * 420 * 1024)
        : Math.max(24 * 1024, charCount * 2 + 18 * 1024);

  return {
    ...raw,
    totalPages: raw.pages.length,
    currentPage: Math.min(raw.currentPage, Math.max(0, raw.pages.length - 1)),
    fileSize: raw.fileSize ?? estimatedBytes,
    chapterCount: raw.chapterCount ?? Math.max(1, chapters.size),
    charCount: raw.charCount ?? charCount,
    wordCount: raw.wordCount ?? wordCount,
    pdfMeta:
      raw.pdfMeta ??
      (raw.format === 'PDF'
        ? {
            creator: raw.author,
            producer: 'CozyRead PDF Engine',
            version: 'PDF-1.7',
          }
        : undefined),
  };
}

export const INITIAL_BOOKS: BookItem[] = [
  makeProseBook({
    id: 'song-nuoc-cuu-long',
    title: 'Sông Nước Cửu Long',
    author: 'Nguyễn Ngọc Tư',
    folderId: 'van_hoc',
    folderName: 'Sách Văn Học',
    filePath: '/storage/roms/books/SÁCH VĂN HỌC/Song Nuoc Cuu Long.epub',
    format: 'EPUB',
    coverImage: '/src/assets/images/cover_van_hoc_song_1795579289902.jpg',
    fallbackStyle: { bg: '#2c3e35', accent: '#d9a441', motif: 'river' },
    ambientColor: 'rgba(217, 164, 65, 0.28)',
    synopsis:
      'Tuyển tập tản văn đậm chất phù sa miền Tây Nam Bộ, nơi những con rạch nhỏ và tiếng chèo khua đêm giữ trọn ký ức hiền hòa của một vùng sông nước.',
    currentPage: 2,
    favorite: true,
    bookmarks: [2, 6],
    pages: [
      {
        chapter: 'Chương 1: Khói Chiều Trên Bến',
        heading: 'I. Mùa Nước Nổi',
        paragraphs: [
          'Buổi sớm trên nhánh sông Hậu, sương mù còn quấn quýt quanh mấy rặng bần già ven bờ. Tiếng máy ghe nổ giòn tan rồi loãng dần vào khoảng không gian mênh mông màu bạc.',
          'Người ta vẫn bảo đất phương Nam hào sảng như chính dòng nước phù sa không bao giờ cạn. Mỗi độ tháng Bảy âm lịch, nước từ thượng nguồn đổ về đỏ au, mang theo cá linh non và những bông điên điển vàng rực.'
        ],
      },
      {
        chapter: 'Chương 1: Khói Chiều Trên Bến',
        paragraphs: [
          'Ngồi trên mũi xuồng ba lá, nghe gió thổi rạt qua vạt lau sậy, bỗng thấy mọi bộn bề nơi phố thị xa xôi như trôi tuột theo từng nhịp chèo nhẹ bẫng.',
          'Chợ nổi họp từ lúc trời còn tối mịt. Những cây bẹo cắm trước mũi ghe treo lủng lẳng trái khóm, buồng chuối hay mớ rau đồng như một bảng hiệu mộc mạc giữa dòng.'
        ],
      },
      {
        chapter: 'Chương 1: Khói Chiều Trên Bến',
        paragraphs: [
          'Ánh đèn dầu le lói hắt xuống mặt nước lăn tăn, tạo thành những dải vàng sóng sánh. Tiếng cười nói chào mời vang lên rộn rã mà thân tình, chẳng chút vội vã.',
          'Mỗi tô hủ tiếu ghe nóng hổi bưng lên giữa làn hơi nước sớm mai dường như ngon hơn gấp bội phần nhờ vị gió sông phóng khoáng.'
        ],
      },
      {
        chapter: 'Chương 2: Đêm Nghe Đờn Ca',
        heading: 'II. Nhịp Song Lang',
        paragraphs: [
          'Chiều buông xuống nhanh như một cái chớp mắt. Ráng đỏ cuối chân trời tắt dần, nhường chỗ cho tiếng ếch nhái râm ran sau vườn dừa.',
          'Trên hiên nhà sàn lợp lá, ấm trà sen đã châm nước thứ hai. Tiếng đờn kìm réo rắt cất lên hòa cùng nhịp gõ song lang chắc nịch.'
        ],
      },
      {
        chapter: 'Chương 2: Đêm Nghe Đờn Ca',
        paragraphs: [
          'Ai từng đi xa mới thấm thía cái buồn man mác nhưng đầy tình người trong từng câu hát miệt vườn ấy. Đêm sâu dần, trăng thượng tuần treo lơ lửng trên ngọn cau.',
          'Ánh trăng rải bạc xuống khoảng sân đất nện, soi rõ dáng bà nội ngồi phe phẩy chiếc quạt mo kể chuyện ngày cũ.'
        ],
      },
      {
        chapter: 'Chương 3: Mùa Bông Điên Điển',
        heading: 'III. Con Nước Lớn Ròng',
        paragraphs: [
          'Tháng Chín, nước tràn lên ngập trắng cả cánh đồng xa. Những rặng tràm đứng soi bóng xuống mặt nước phẳng lặng như gương.',
          'Lũ trẻ trong xóm rủ nhau bơi xuồng đi hái bông súng ma, tiếng cười vang vọng từ đầu kinh tới cuối rạch.'
        ],
      },
      {
        chapter: 'Chương 3: Mùa Bông Điên Điển',
        paragraphs: [
          'Chiều về, mùi khói đốt đồng thoảng qua mái bếp lá, quyện với mùi cá kho tộ thơm nức mũi. Chỉ bấy nhiêu thôi cũng đủ giữ chân người lữ khách suốt một đời thương nhớ.',
          'Dòng sông vẫn chảy lặng lẽ qua bao mùa mưa nắng, chở theo những câu chuyện bình dị mà sâu thẳm tình quê.'
        ],
      },
      {
        chapter: 'Chương 4: Bến Đợi Người Về',
        heading: 'IV. Khúc Hát Cuối Mùa',
        paragraphs: [
          'Gió chướng thổi về báo hiệu mùa khô sắp sang. Nước rút dần khỏi ruộng đồng, để lại lớp phù sa màu mỡ cho vụ lúa mới.',
          'Trên bến cũ, con đò ngang vẫn đều đặn đưa khách qua sông mỗi sớm mai, nối liền hai bờ ký ức chưa bao giờ phai nhạt.'
        ],
      },
    ],
  }),

  makeProseBook({
    id: 'thanh-pho-mua-dem',
    title: 'Thành Phố Mưa Đêm — Tập 1',
    author: 'Kurogane Ren',
    folderId: 'truyen_tranh',
    folderName: 'Truyện Tranh',
    filePath: '/storage/roms/books/TRUYỆN TRANH/Thanh Pho Mua Dem Vol1.cbz',
    format: 'CBZ',
    coverImage: '/src/assets/images/cover_manga_cyber_1795579291466.jpg',
    fallbackStyle: { bg: '#0e1d2f', accent: '#38bdf8', motif: 'sky' },
    ambientColor: 'rgba(56, 189, 248, 0.30)',
    synopsis:
      'Trong khu đô thị tầng cao phủ kín màn mưa nhân tạo, một người đưa thư bóng đêm mang theo bí mật cuối cùng về bầu trời xanh đã mất.',
    currentPage: 1,
    favorite: true,
    bookmarks: [1, 4],
    pages: [
      {
        chapter: 'Hồi 01: Tín Hiệu Lúc Nửa Đêm',
        comicScene: {
          panelTitle: 'KHU 7 — TẦNG MÁI THÁP ĐỒNG HỒ',
          caption: '23:45 — Cơn mưa nhân tạo vẫn rơi không dứt trên những tấm biển hiệu neon cũ kỹ.',
          dialogue: [
            { speaker: 'Kaito', text: 'Tín hiệu vừa phát đi từ tầng hầm B4. Không nhầm vào đâu được...' },
            { speaker: 'Radio', text: 'Đã xác nhận bưu kiện số 09. Rời khỏi đó trước khi đội tuần tra tới.' },
          ],
          palette: ['#0b192c', '#0ea5e9', '#f97316'],
          mood: 'rain',
          sceneVariant: 1,
        },
      },
      {
        chapter: 'Hồi 01: Tín Hiệu Lúc Nửa Đêm',
        comicScene: {
          panelTitle: 'ĐƯỜNG HẦM TÀU ĐIỆN CŨ',
          caption: 'Ánh đèn pin cắt ngang lớp bụi thời gian của tuyến tàu điện bị bỏ hoang 30 năm.',
          dialogue: [
            { speaker: 'Kaito', text: 'Chiếc hộp này nhẹ hơn mình tưởng. Bên trong rốt cuộc chứa thứ gì?' },
            { speaker: 'Giọng lạ', text: 'Đừng mở nó dưới lòng đất. Ánh sáng mặt trời mới là chìa khóa.' },
          ],
          palette: ['#0f172a', '#22d3ee', '#fb923c'],
          mood: 'rain',
          sceneVariant: 2,
        },
      },
      {
        chapter: 'Hồi 02: Đường Lên Mái Vòm',
        comicScene: {
          panelTitle: 'THANG MÁY KÍNH TẦNG 88',
          caption: 'Thành phố ánh sáng thu nhỏ dần bên dưới lớp mây công nghiệp dày đặc.',
          dialogue: [
            { speaker: 'Kaito', text: 'Chỉ còn 12 tầng nữa là vượt qua màn sương mù...' },
            { speaker: 'Hệ thống', text: 'Cảnh báo: Phát hiện chuyển động trái phép tại trục số 3!' },
          ],
          palette: ['#111827', '#38bdf8', '#f59e0b'],
          mood: 'rain',
          sceneVariant: 3,
        },
      },
      {
        chapter: 'Hồi 02: Đường Lên Mái Vòm',
        comicScene: {
          panelTitle: 'CẦU NỐI TRÊN KHÔNG',
          caption: 'Tiếng bước chân dồn dập vang lên giữa cơn gió mạnh ở độ cao 400 mét.',
          dialogue: [
            { speaker: 'Kaito', text: 'Cánh cửa thoát hiểm kia rồi! Chỉ một cú nhảy nữa thôi!' },
          ],
          palette: ['#0c1a2e', '#06b6d4', '#fb7185'],
          mood: 'rain',
          sceneVariant: 4,
        },
      },
      {
        chapter: 'Hồi 03: Bầu Trời Thật',
        comicScene: {
          panelTitle: 'ĐỈNH MÁI VÒM PHÍA ĐÔNG',
          caption: 'Lần đầu tiên sau hai thập kỷ, lớp mây rẽ đôi để lộ dải ngân hà lấp lánh.',
          dialogue: [
            { speaker: 'Kaito', text: 'Thì ra bầu trời thật... lại có màu sâu thẳm và yên bình đến thế.' },
          ],
          palette: ['#0c1222', '#60a5fa', '#fde047'],
          mood: 'sky',
          sceneVariant: 5,
        },
      },
      {
        chapter: 'Hồi 03: Bầu Trời Thật',
        comicScene: {
          panelTitle: 'BÌNH MINH ĐẦU TIÊN',
          caption: 'Chiếc hộp phát sáng nhẹ, giải phóng bản đồ tọa độ của thành phố vườn địa đàng.',
          dialogue: [
            { speaker: 'Kaito', text: 'Hành trình thực sự mới chỉ bắt đầu từ đây...' },
          ],
          palette: ['#162447', '#38bdf8', '#fcd34d'],
          mood: 'sky',
          sceneVariant: 6,
        },
      },
    ],
  }),

  makeProseBook({
    id: 'ngon-hai-dang-cuoi-mua',
    title: 'Ngọn Hải Đăng Cuối Mùa',
    author: 'Virginia Woolf',
    folderId: 'van_hoc',
    folderName: 'Sách Văn Học',
    filePath: '/storage/roms/books/SÁCH VĂN HỌC/Ngon Hai Dang Cuoi Mua.epub',
    format: 'EPUB',
    coverImage: '/src/assets/images/cover_tieu_thuyet_dem_1795579290745.jpg',
    fallbackStyle: { bg: '#1e2538', accent: '#f59e0b', motif: 'river' },
    ambientColor: 'rgba(245, 158, 11, 0.28)',
    synopsis:
      'Một kiệt tác về ký ức, thời gian và những biến đổi lặng lẽ trong tâm hồn con người bên bờ biển gió lộng phía Bắc.',
    currentPage: 1,
    favorite: false,
    bookmarks: [3],
    pages: [
      {
        chapter: 'Phần I: Khung Cửa Sổ',
        heading: 'Ánh Sáng Lúc Hoàng Hôn',
        paragraphs: [
          '"Vâng, tất nhiên rồi, nếu ngày mai trời đẹp," bà Ramsay nói, mắt vẫn dõi theo những vệt nắng cuối ngày trải dài trên mặt vịnh phẳng lặng.',
          'Ngọn hải đăng phía ngoài mỏm đá bắt đầu quét những vòng sáng vàng ấm áp qua làn sương muối. Với cậu bé James, tháp đá ấy vừa gần gũi như một người bạn, vừa xa xôi như miền đất hứa.'
        ],
      },
      {
        chapter: 'Phần I: Khung Cửa Sổ',
        paragraphs: [
          'Sóng vỗ vào ghềnh đá theo nhịp đều đặn ngàn năm không đổi, nhắc nhở mọi người trong căn nhà nghỉ mát rằng thời gian vẫn lặng lẽ trôi qua từng kẽ tay.',
          'Lily Briscoe đặt giá vẽ ra bãi cỏ, nheo mắt nhìn khối hình học của ngôi nhà hòa vào nền trời xanh thẫm.'
        ],
      },
      {
        chapter: 'Phần I: Khung Cửa Sổ',
        paragraphs: [
          'Cô hiểu mình không chỉ vẽ lại hình dáng vật thể, mà đang cố giữ lại một khoảnh khắc cảm xúc dễ tan biến giữa dòng đời vội vã.',
          'Tiếng chuông báo bữa tối vang lên từ phòng ăn. Mọi người quay trở vào ánh đèn ấm, mang theo mùi muối biển vương trên áo khoác len.'
        ],
      },
      {
        chapter: 'Phần II: Thời Gian Trôi',
        heading: 'Mười Năm Sau',
        paragraphs: [
          'Ngôi nhà đứng lặng qua nhiều mùa đông bão tuyết. Gió biển thổi qua những hành lang vắng, lật nhẹ từng trang sách cũ nằm quên trên bàn.',
          'Rồi một buổi sáng mùa thu trong trẻo, những ô cửa sổ lại được mở tung đón ánh mặt trời rực rỡ.'
        ],
      },
      {
        chapter: 'Phần III: Ngọn Hải Đăng',
        heading: 'Cập Bến',
        paragraphs: [
          'Khi con thuyền buồm nhỏ rẽ sóng tiến gần chân tháp hải đăng sau mười năm chờ đợi, mọi thứ dường như bé lại so với ký ức thuở thơ ấu.',
          'Chỉ có tia sáng từ đỉnh tháp vẫn kiên nhẫn xoay vòng trong buổi chiều tà, kết nối quá khứ và hiện tại thành một đường tròn trọn vẹn.'
        ],
      },
      {
        chapter: 'Phần III: Ngọn Hải Đăng',
        paragraphs: [
          'Trên bãi cỏ trước nhà, Lily đặt nét cọ cuối cùng vào trung tâm bức tranh đã dang dở suốt một thập kỷ.',
          'Ánh nắng cuối chiều tắt hẳn trên mặt biển, để lại cảm giác thanh thản như vừa hoàn thành một lời hứa lâu năm.'
        ],
      },
    ],
  }),

  makeProseBook({
    id: 'khu-rung-co-tich',
    title: 'Khu Rừng Cổ Tích — Tập 3',
    author: 'Aoi Haruka',
    folderId: 'truyen_tranh',
    folderName: 'Truyện Tranh',
    filePath: '/storage/roms/books/TRUYỆN TRANH/Khu Rung Co Tich Vol3.cbz',
    format: 'CBZ',
    coverImage: '/src/assets/images/cover_manga_forest_1795579291974.jpg',
    fallbackStyle: { bg: '#163024', accent: '#4ade80', motif: 'zen' },
    ambientColor: 'rgba(74, 222, 128, 0.25)',
    synopsis:
      'Hành trình tìm lại những vị thần ngủ quên trong khu rừng tuyết tùng cổ đại phía sau ngôi đền rêu phong.',
    currentPage: 0,
    favorite: true,
    bookmarks: [],
    pages: [
      {
        chapter: 'Chương 12: Cổng Đá Rêu Phong',
        comicScene: {
          panelTitle: 'THUNG LŨNG TUYẾT TÙNG',
          caption: 'Những tia nắng buổi sáng xuyên qua tán lá dày, đánh thức bầy đom đóm rừng.',
          dialogue: [
            { speaker: 'Mei', text: 'Nhìn kìa! Cánh cổng đá trong bản đồ của ông nội vẫn còn nguyên vẹn!' },
            { speaker: 'Chibi', text: 'Ngửi thấy mùi mưa và rêu cổ... Có ai đó đang đợi chúng ta phía bên kia.' },
          ],
          palette: ['#0f291e', '#22c55e', '#fde047'],
          mood: 'forest',
          sceneVariant: 1,
        },
      },
      {
        chapter: 'Chương 12: Cổng Đá Rêu Phong',
        comicScene: {
          panelTitle: 'SUỐI NGUỒN TRONG VẮT',
          caption: 'Mặt nước phản chiếu bầu trời xanh ngắt, từng viên sỏi phát sáng khe khẽ.',
          dialogue: [
            { speaker: 'Mei', text: 'Nếu bước qua cây cầu gỗ này, khu rừng sẽ đưa mình tới mùa hạ vĩnh cửu sao?' },
          ],
          palette: ['#123326', '#34d399', '#fef08a'],
          mood: 'forest',
          sceneVariant: 2,
        },
      },
      {
        chapter: 'Chương 13: Ngôi Đền Bị Lãng Quên',
        comicScene: {
          panelTitle: 'BẬC THANG ĐÁ CỔ',
          caption: 'Chuông gió bằng đồng khẽ ngân lên dù không có một ngọn gió nào thổi qua.',
          dialogue: [
            { speaker: 'Thần Rừng', text: 'Đã trăm năm rồi mới có bước chân người tìm đến nơi đây.' },
            { speaker: 'Mei', text: 'Cháu mang theo hạt giống cây tuyết tùng cổ thụ để trả lại cho rừng!' },
          ],
          palette: ['#0d261a', '#4ade80', '#fde047'],
          mood: 'forest',
          sceneVariant: 3,
        },
      },
      {
        chapter: 'Chương 13: Ngôi Đền Bị Lãng Quên',
        comicScene: {
          panelTitle: 'ÁNH SÁNG MÙA HẠ',
          caption: 'Cả thung lũng bừng sáng trong sắc vàng ấm áp khi mầm cây đầu tiên vươn lên.',
          dialogue: [
            { speaker: 'Chibi', text: 'Khu rừng tỉnh giấc rồi Mei ơi!' },
          ],
          palette: ['#133828', '#22c55e', '#fef08a'],
          mood: 'forest',
          sceneVariant: 4,
        },
      },
      {
        chapter: 'Chương 14: Đường Trở Về',
        comicScene: {
          panelTitle: 'HOÀNG HÔN TRÊN ĐỒI CỎ',
          caption: 'Bóng hai người bạn nhỏ kéo dài trên con đường mòn dẫn về làng.',
          dialogue: [
            { speaker: 'Mei', text: 'Mùa hè năm sau mình sẽ quay lại thăm khu rừng này nhé.' },
          ],
          palette: ['#1d2e22', '#86efac', '#fbbf24'],
          mood: 'autumn',
          sceneVariant: 5,
        },
      },
      {
        chapter: 'Chương 14: Đường Trở Về',
        comicScene: {
          panelTitle: 'KẾT THÚC TẬP 3',
          caption: 'Hẹn gặp lại trong hành trình mùa thu ở Tập 4.',
          dialogue: [
            { speaker: 'Chibi', text: 'Luôn có những phép màu ẩn sau tán lá xanh!' },
          ],
          palette: ['#0f291e', '#34d399', '#fde047'],
          mood: 'forest',
          sceneVariant: 6,
        },
      },
    ],
  }),

  makeProseBook({
    id: 'vu-tru-trong-vo-hat-de',
    title: 'Vũ Trụ Trong Vỏ Hạt Dẻ',
    author: 'Stephen Hawking',
    folderId: 'ky_nang',
    folderName: 'Kỹ Năng & Lịch Sử',
    filePath: '/storage/roms/books/KỸ NĂNG & LỊCH SỬ/Vu Tru Trong Vo Hat De.epub',
    format: 'EPUB',
    coverImage: '/src/assets/images/cover_kynang_cosmos_1795579291927.jpg',
    fallbackStyle: { bg: '#111625', accent: '#eab308', motif: 'sky' },
    ambientColor: 'rgba(234, 179, 8, 0.26)',
    synopsis:
      'Cuộc du hành kỳ thú vào bản chất của không gian, thời gian, hố đen và những chiều kích ẩn giấu của vũ trụ hiện đại.',
    currentPage: 2,
    favorite: false,
    bookmarks: [2],
    pages: [
      {
        chapter: 'Chương 1: Lược Sử Thuyết Tương Đối',
        heading: 'Không-Thời Gian Co Giãn',
        paragraphs: [
          'Hamlet từng nói: "Ta có thể bị giam trong một vỏ hạt dẻ mà vẫn tự coi mình là chúa tể của không gian vô tận." Vật lý lý thuyết hiện đại thực sự cho thấy một điều kỳ diệu tương tự.',
          'Trước thế kỷ XX, con người tin rằng thời gian trôi đều đặn như một dòng sông bất biến cho mọi người ở mọi nơi.'
        ],
      },
      {
        chapter: 'Chương 1: Lược Sử Thuyết Tương Đối',
        paragraphs: [
          'Nhưng Albert Einstein đã chứng minh thời gian có thể chậm lại khi bạn di chuyển gần vận tốc ánh sáng.',
          'Không gian và thời gian không phải là sân khấu cứng nhắc, mà là một tấm vải đàn hồi uốn cong dưới sức nặng của các ngôi sao và thiên hà.'
        ],
      },
      {
        chapter: 'Chương 2: Hình Dạng Của Thời Gian',
        heading: 'Thời Gian Ảo & Hố Đen',
        paragraphs: [
          'Nếu ta hình dung thời gian như một trục thẳng đứng, tương lai ở phía trên và quá khứ ở phía dưới, thì gần các hố đen siêu khối lượng, trục ấy bị bẻ cong mạnh mẽ.',
          'Chính sự giao thoa giữa cơ học lượng tử ở cấp độ vi mô và thuyết tương đối rộng ở cấp độ vĩ mô đã mở ra những câu hỏi sâu sắc nhất của nhân loại.'
        ],
      },
      {
        chapter: 'Chương 2: Hình Dạng Của Thời Gian',
        paragraphs: [
          'Bức xạ Hawking cho thấy hố đen thực ra không hoàn toàn đen tối mà phát ra một lượng năng lượng nhỏ bé, khiến chúng bay hơi chậm rãi qua hàng tỷ năm.',
          'Điều đó giúp gắn kết nhiệt động lực học với lực hấp dẫn theo một cách đẹp đẽ đến kinh ngạc.'
        ],
      },
      {
        chapter: 'Chương 3: Vũ Trụ Trong Vỏ Hạt Dẻ',
        heading: 'Lý Thuyết Màng & Đa Chiều',
        paragraphs: [
          'Trong lý thuyết M, vũ trụ quen thuộc có thể chỉ là một màng bốn chiều trôi nổi trong không gian nhiều chiều hơn.',
          'Dù chưa thể quan sát trực tiếp các chiều kích cuộn tròn cực nhỏ, toán học vẫn cho phép chúng ta vẽ nên bức tranh nhất quán về thuở sơ khai.'
        ],
      },
      {
        chapter: 'Chương 4: Dự Đoán Tương Lai',
        heading: 'Khát Vọng Khám Phá',
        paragraphs: [
          'Trí tuệ con người luôn tìm cách vượt qua giới hạn sinh học để vươn tới những vì sao xa xôi nhất.',
          'Hiểu biết về quy luật vũ trụ không làm chúng ta nhỏ bé đi, mà giúp ta trân trọng hơn sự kỳ diệu của hành tinh xanh đang nuôi dưỡng sự sống.'
        ],
      },
    ],
  }),

  makeProseBook({
    id: 'de-men-phieu-luu-ky',
    title: 'Dế Mèn Phiêu Lưu Ký',
    author: 'Tô Hoài',
    folderId: 'van_hoc',
    folderName: 'Sách Văn Học',
    filePath: '/storage/roms/books/SÁCH VĂN HỌC/De Men Phieu Luu Ky.epub',
    format: 'EPUB',
    fallbackStyle: { bg: '#1b3b2b', accent: '#fbbf24', motif: 'zen' },
    ambientColor: 'rgba(251, 191, 36, 0.24)',
    synopsis:
      'Tác phẩm đồng thoại kinh điển của văn học Việt Nam kể về hành trình trưởng thành, tình bạn và khát vọng thế giới đại đồng của chú Dế Mèn.',
    currentPage: 1,
    favorite: false,
    bookmarks: [],
    pages: [
      {
        chapter: 'Chương 1: Bài Học Đường Đời Đầu Tiên',
        heading: 'Chàng Dế Thanh Niên Cường Tráng',
        paragraphs: [
          'Tôi sống độc lập từ thuở bé. Ấy là tục lệ lâu đời trong họ nhà dế chúng tôi. Vả lại, mẹ thường bảo chúng tôi rằng: "Phải như thế để các con biết kiếm ăn một mình cho quen đi."',
          'Bởi tôi ăn uống điều độ và làm việc có chừng mực nên tôi chóng lớn lắm. Chẳng bao lâu, tôi đã trở thành một chàng dế thanh niên cường tráng.'
        ],
      },
      {
        chapter: 'Chương 1: Bài Học Đường Đời Đầu Tiên',
        paragraphs: [
          'Đôi càng tôi mẫm bóng. Những cái vuốt ở chân, ở khoeo cứ cứng dần và nhọn hoắt. Thỉnh thoảng, muốn thử sự lợi hại của những chiếc vuốt, tôi co cẳng lên, đạp phanh phách vào các ngọn cỏ.',
          'Những ngọn cỏ gãy rạp, y như có nhát dao vừa lia qua. Đôi cánh tôi, trước kia ngắn hủn hoẳn, bây giờ thành cái áo dài kín xuống tận chấm đuôi.'
        ],
      },
      {
        chapter: 'Chương 1: Bài Học Đường Đời Đầu Tiên',
        paragraphs: [
          'Nhưng tuổi trẻ kiêu ngạo thường dễ mắc sai lầm. Chỉ vì một trò đùa ngông cuồng trêu chị Cốc mà người bạn hàng xóm yếu ớt Dế Choắt phải chịu vạ lây.',
          'Lời khuyên cuối cùng của Dế Choắt về thói hung hăng bậy bạ đã theo tôi suốt những chặng đường phiêu lưu rộng lớn sau này.'
        ],
      },
      {
        chapter: 'Chương 2: Cuộc Phiêu Lưu Bất Ngờ',
        heading: 'Gặp Dế Trũi',
        paragraphs: [
          'Rời khỏi bãi cỏ quen thuộc, tôi bước vào thế giới rộng lớn với biết bao điều mới lạ. May mắn thay, tôi gặp được người bạn đồng hành chân thành là Dế Trũi.',
          'Hai anh em kết nghĩa cùng nhau vượt qua sông rộng, qua đầm lầy, học cách giúp đỡ những kẻ yếu thế trên đường đi.'
        ],
      },
      {
        chapter: 'Chương 3: Đầm Lầy & Vương Quốc Kiến',
        heading: 'Tình Bạn Giữa Muôn Loài',
        paragraphs: [
          'Càng đi xa, tôi càng hiểu thế giới muôn loài tuy khác biệt hình dáng nhưng đều chung ước vọng sống hòa bình, không ức hiếp lẫn nhau.',
          'Từ chú dế hống hách ngày nào, những thử thách dọc đường đã rèn giũa cho tôi lòng dũng cảm và sự điềm tĩnh.'
        ],
      },
      {
        chapter: 'Chương 4: Trở Về Quê Cũ',
        heading: 'Khúc Hát Hòa Bình',
        paragraphs: [
          'Khi mùa thu quay lại trên cánh đồng cỏ may, tôi và Trũi lại lên đường cho những chân trời mới, mang theo thông điệp muôn loài đều là anh em.',
          'Bầu trời quê hương hôm ấy cao xanh và lộng gió lạ thường.'
        ],
      },
    ],
  }),

  makeProseBook({
    id: 'so-do-vu-trong-phung',
    title: 'Số Đỏ',
    author: 'Vũ Trọng Phụng',
    folderId: 'van_hoc',
    folderName: 'Sách Văn Học',
    filePath: '/storage/roms/books/SÁCH VĂN HỌC/So Do - Vu Trong Phung.epub',
    format: 'EPUB',
    fallbackStyle: { bg: '#4a1820', accent: '#f4c47f', motif: 'crimson' },
    ambientColor: 'rgba(244, 196, 127, 0.25)',
    synopsis:
      'Tiểu thuyết trào phúng bậc thầy phơi bày những nghịch lý hài hước của xã hội thành thị giao thời qua nhân vật Xuân Tóc Đỏ.',
    currentPage: 0,
    favorite: false,
    bookmarks: [],
    pages: [
      {
        chapter: 'Chương 1: Xuân Tóc Đỏ Xuất Hiện',
        heading: 'Sân Quần Vợt Buổi Trưa',
        paragraphs: [
          'Ánh nắng gay gắt của trưa hè Hà Nội hắt xuống mặt sân đất nện đỏ au. Tiếng bóng nảy lốp bốp xen lẫn tiếng hô điểm bằng tiếng Pháp lơ lớ vang vọng ra tận ngoài hàng rào sắt.',
          'Xuân đứng nép bên gốc sấu, đôi mắt lanh lẹ dõi theo từng đường bóng lăn vào bụi cỏ để chạy ra nhặt cho các ông chủ.'
        ],
      },
      {
        chapter: 'Chương 1: Xuân Tóc Đỏ Xuất Hiện',
        paragraphs: [
          'Cái nghề nhặt banh tưởng nhỏ mọn ấy lại chính là cánh cửa đưa hắn bước vào một thế giới thượng lưu đầy oái oăm.',
          'Chỉ vài tuần sau, nhờ vài câu lỏm được ở hiệu thuốc gia truyền và bộ cánh Âu hóa bóng bẩy, không ai còn nhận ra cậu bé bán lạc rang thuở nào.'
        ],
      },
      {
        chapter: 'Chương 2: Hiệu May Âu Hóa',
        heading: 'Cuộc Cải Cách Trang Phục',
        paragraphs: [
          'Tại tiệm may sang trọng nhất phố, ông Typn say sưa thuyết giảng về những bộ y phục tân thời với cái tên mỹ miều đầy tính hài hước.',
          'Xuân nhanh chóng trở thành người quảng cáo đắc lực nhất nhờ tài ăn nói bạo dạn và sự vô tư đến mức kỳ lạ.'
        ],
      },
      {
        chapter: 'Chương 3: Đám Tang Gương Mẫu',
        heading: 'Màn Kịch Trớ Trêu',
        paragraphs: [
          'Trong khung cảnh long trọng đến mức lố bịch của đám rước qua các con phố lớn, ai nấy đều bận khoe mẽ bộ mặt đạo mạo hay bộ cánh mới may.',
          'Ngòi bút sắc sảo của tác giả lột tả trọn vẹn những tiếng cười ra nước mắt của một thời kỳ giao thời.'
        ],
      },
      {
        chapter: 'Chương 4: Nhà Quán Quân Bất Đắc Dĩ',
        heading: 'Ánh Đèn Sân Vận Động',
        paragraphs: [
          'Dưới tiếng reo hò vang dội của hàng nghìn khán giả, Xuân Tóc Đỏ bước lên bục danh vọng như một anh hùng thể thao không ai ngờ tới.',
          'Vở hài kịch khép lại trong tiếng vỗ tay rào rào, để lại dư vị châm biếm sâu cay khó quên.'
        ],
      },
    ],
  }),

  makeProseBook({
    id: 'hanh-trinh-bau-troi',
    title: 'Hành Trình Bầu Trời',
    author: 'Sora Takeshi',
    folderId: 'truyen_tranh',
    folderName: 'Truyện Tranh',
    filePath: '/storage/roms/books/TRUYỆN TRANH/Hanh Trinh Bau Troi.cbz',
    format: 'CBZ',
    fallbackStyle: { bg: '#162d4c', accent: '#7dd3fc', motif: 'sky' },
    ambientColor: 'rgba(125, 211, 252, 0.25)',
    synopsis:
      'Những con tàu buồm bay bằng khí cầu đi xuyên qua biển mây để vẽ lại bản đồ các quần đảo lơ lửng.',
    currentPage: 1,
    favorite: false,
    bookmarks: [],
    pages: [
      {
        chapter: 'Chặng 1: Cảng Gió Tây',
        comicScene: {
          panelTitle: 'BOONG TÀU KHÍ CẦU ALBATROSS',
          caption: 'Cánh buồm trắng căng gió lúc rạng đông, mũi tàu hướng về biển mây phía Nam.',
          dialogue: [
            { speaker: 'Thuyền trưởng', text: 'Kiểm tra lại áp suất buồng khí! Phía trước có dòng hải lưu trên không!' },
            { speaker: 'Hoa tiêu', text: 'Rõ thưa thuyền trưởng! Đảo Đá Nổi chỉ còn cách 12 hải lý nữa!' },
          ],
          palette: ['#0c2340', '#38bdf8', '#fde68a'],
          mood: 'sky',
          sceneVariant: 1,
        },
      },
      {
        chapter: 'Chặng 1: Cảng Gió Tây',
        comicScene: {
          panelTitle: 'BIỂN MÂY TẦNG CAO',
          caption: 'Những đàn cá bay lượn quanh mạn tàu dưới ánh nắng chói chang.',
          dialogue: [
            { speaker: 'Hoa tiêu', text: 'Gió thuận lợi lắm! Tốc độ hiện tại đạt 45 hải lý mỗi giờ!' },
          ],
          palette: ['#0f2d52', '#60a5fa', '#fef08a'],
          mood: 'sky',
          sceneVariant: 2,
        },
      },
      {
        chapter: 'Chặng 2: Quần Đảo Lơ Lửng',
        comicScene: {
          panelTitle: 'THÁC NƯỚC GIỮA KHÔNG TRUNG',
          caption: 'Dòng nước từ hòn đảo treo đổ xuống biển mây tạo thành cầu vồng rực rỡ.',
          dialogue: [
            { speaker: 'Thuyền trưởng', text: 'Thả neo mỏ neo đồng! Chúng ta sẽ bổ sung nước ngọt tại đây.' },
          ],
          palette: ['#123456', '#34d399', '#fde047'],
          mood: 'forest',
          sceneVariant: 3,
        },
      },
      {
        chapter: 'Chặng 2: Quần Đảo Lơ Lửng',
        comicScene: {
          panelTitle: 'BẢN ĐỒ CHƯA TỪNG CÓ',
          caption: 'Từng nét mực mới được ghi lên tấm da thuộc dưới ánh đèn bão.',
          dialogue: [
            { speaker: 'Hoa tiêu', text: 'Tọa độ đảo thứ bảy đã hoàn tất. Hướng thẳng về chân trời thôi!' },
          ],
          palette: ['#0c2340', '#38bdf8', '#fcd34d'],
          mood: 'sky',
          sceneVariant: 4,
        },
      },
    ],
  }),

  makeProseBook({
    id: 'pho-cu-mua-thu',
    title: 'Phố Cũ Mùa Thu',
    author: 'Minh An',
    folderId: 'truyen_tranh',
    folderName: 'Truyện Tranh',
    filePath: '/storage/roms/books/TRUYỆN TRANH/Pho Cu Mua Thu.pdf',
    format: 'PDF',
    fallbackStyle: { bg: '#3f2316', accent: '#fb923c', motif: 'autumn' },
    ambientColor: 'rgba(251, 146, 60, 0.26)',
    synopsis:
      'Tập truyện màu nhẹ nhàng về một tiệm sửa đồng hồ cổ nằm cuối con ngõ lá vàng rơi.',
    currentPage: 0,
    favorite: false,
    bookmarks: [],
    pages: [
      {
        chapter: 'Trang 1: Chuông Gió Tháng Mười',
        comicScene: {
          panelTitle: 'TIỆM ĐỒNG HỒ SỐ 14',
          caption: 'Nắng thu hanh vàng rót qua ô cửa kính nhỏ, tiếng tích tắc vang lên êm ả.',
          dialogue: [
            { speaker: 'Ông Tư', text: 'Chiếc đồng hồ quả quýt này đã dừng từ năm 1998. Hôm nay ta sẽ đánh thức nó dậy.' },
          ],
          palette: ['#3b1d12', '#f97316', '#fde68a'],
          mood: 'autumn',
          sceneVariant: 1,
        },
      },
      {
        chapter: 'Trang 2: Bánh Răng Ký Ức',
        comicScene: {
          panelTitle: 'BÀN LÀM VIỆC BẰNG GỖ SỒI',
          caption: 'Dưới kính lúp, những bánh răng bằng đồng sáng bóng lại sau lớp dầu mới.',
          dialogue: [
            { speaker: 'Khách', text: 'Cháu tưởng nó không thể chạy lại được nữa chứ ạ!' },
            { speaker: 'Ông Tư', text: 'Đồ cũ chỉ ngủ quên thôi, chỉ cần kiên nhẫn là lại chạy đều.' },
          ],
          palette: ['#452113', '#fb923c', '#fef08a'],
          mood: 'autumn',
          sceneVariant: 2,
        },
      },
      {
        chapter: 'Trang 3: Con Ngõ Lá Vàng',
        comicScene: {
          panelTitle: 'CHIỀU MUỘN',
          caption: 'Tiếng chuông đồng hồ điểm năm giờ chiều hòa cùng tiếng rao hàng rong ngoài ngõ.',
          dialogue: [
            { speaker: 'Ông Tư', text: 'Mùa thu năm nay dịu dàng quá.' },
          ],
          palette: ['#2e160d', '#f59e0b', '#fde68a'],
          mood: 'autumn',
          sceneVariant: 3,
        },
      },
      {
        chapter: 'Trang 4: Hẹn Mùa Thu Sau',
        comicScene: {
          panelTitle: 'ÁNH ĐÈN VÀNG',
          caption: 'Tấm biển "Đang mở cửa" khẽ đung đưa trước làn gió heo may đầu mùa.',
          dialogue: [
            { speaker: 'Khách', text: 'Cảm ơn ông Tư! Cháu sẽ giữ gìn chiếc đồng hồ này thật cẩn thận.' },
          ],
          palette: ['#3b1d12', '#fb923c', '#fde047'],
          mood: 'autumn',
          sceneVariant: 4,
        },
      },
    ],
  }),

  makeProseBook({
    id: 'nghe-thuat-toi-gian',
    title: 'Nghệ Thuật Sống Tối Giản',
    author: 'Sasaki Fumio',
    folderId: 'ky_nang',
    folderName: 'Kỹ Năng & Lịch Sử',
    filePath: '/storage/roms/books/KỸ NĂNG & LỊCH SỬ/Nghe Thuat Song Toi Gian.pdf',
    format: 'PDF',
    fallbackStyle: { bg: '#26292e', accent: '#cbd5e1', motif: 'zen' },
    ambientColor: 'rgba(203, 213, 225, 0.2)',
    synopsis:
      'Cách cắt giảm những đồ vật thừa thãi để nhường chỗ cho sự tĩnh tại, tự do tinh thần và những giá trị thực sự có ý nghĩa.',
    currentPage: 0,
    favorite: false,
    bookmarks: [],
    pages: [
      {
        chapter: 'Chương 1: Khoảng Trống Bình Yên',
        heading: 'Hạnh Phúc Không Nằm Ở Số Lượng',
        paragraphs: [
          'Chúng ta thường nghĩ rằng sở hữu càng nhiều đồ vật thì cuộc sống càng đủ đầy. Nhưng thực chất, mỗi đồ vật dư thừa lại âm thầm lấy đi một phần thời gian và sự chú tâm của ta.',
          'Khi căn phòng trở nên thoáng đãng chỉ còn lại những món đồ thực sự yêu thích và hữu dụng, tâm trí cũng tự nhiên nhẹ nhõm theo.'
        ],
      },
      {
        chapter: 'Chương 1: Khoảng Trống Bình Yên',
        paragraphs: [
          'Tối giản không phải là khắc khổ, mà là nghệ thuật chọn lọc tinh tế để dành trọn năng lượng cho những trải nghiệm đáng giá nhất.',
          'Mỗi buổi sáng thức dậy trong không gian gọn gàng giúp ta bắt đầu ngày mới với sự minh mẫn tuyệt đối.'
        ],
      },
      {
        chapter: 'Chương 2: Quy Tắc Buông Bỏ',
        heading: 'Giữ Lại Điều Thực Sự Cần',
        paragraphs: [
          'Hãy thử hỏi bản thân: nếu món đồ này biến mất hôm nay, mình có sẵn sàng mua lại nó với giá đầy đủ không? Câu trả lời sẽ giúp bạn phân loại rất nhanh.',
          'Bớt đi tiếng ồn từ vật chất cũng là cách lắng nghe rõ hơn tiếng nói bên trong chính mình.'
        ],
      },
      {
        chapter: 'Chương 3: Tự Do Thời Gian',
        heading: 'Sống Chậm Lại',
        paragraphs: [
          'Khi không còn phải bận tâm dọn dẹp hay bảo quản quá nhiều thứ, bạn bỗng có thêm hàng giờ mỗi tuần để đọc một cuốn sách hay hoặc đi dạo cùng người thân.',
          'Sự giàu có đích thực nằm ở khoảng thời gian tự do mà ta thực sự làm chủ.'
        ],
      },
    ],
  }),
];
