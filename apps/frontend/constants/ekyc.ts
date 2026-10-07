export interface EkycStep {
  id: "front" | "left" | "right" | "up" | "smile" | "blink";
  title: string;
  voicePrompt: string;
  direction?: "left" | "right" | "up" | "center";
}

export const EKYC_STEPS: EkycStep[] = [
  {
    id: "front",
    title: "Nhìn thẳng vào khung hình (1/5)",
    voicePrompt: "Vui lòng nhìn thẳng vào vòng tròn",
    direction: "center",
  },
  {
    id: "blink",
    title: "Vui lòng chớp mắt một cái (2/5)",
    voicePrompt: "Vui lòng chớp mắt",
    direction: "center",
  },
  {
    id: "left",
    title: "Quay mặt sang bên trái (3/5)",
    voicePrompt: "Vui lòng quay mặt sang bên trái",
    direction: "left",
  },
  {
    id: "right",
    title: "Quay mặt sang bên phải (4/5)",
    voicePrompt: "Vui lòng quay mặt sang bên phải",
    direction: "right",
  },
  {
    id: "up",
    title: "Hơi ngẩng cằm lên trên (5/5)",
    voicePrompt: "Vui lòng ngẩng cằm lên một chút",
    direction: "up",
  },
];
