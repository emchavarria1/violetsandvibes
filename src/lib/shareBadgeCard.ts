type ShareBadgeCardInput = {
  badgeTitle: string;
  badgeSubtitle: string;
  profileName?: string;
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines;
}

export async function createBadgeShareCard({
  badgeTitle,
  badgeSubtitle,
  profileName,
}: ShareBadgeCardInput) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is not available");
  }

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#150d2e");
  bg.addColorStop(0.55, "#0f0b1f");
  bg.addColorStop(1, "#08060f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const orbA = ctx.createRadialGradient(220, 240, 40, 220, 240, 360);
  orbA.addColorStop(0, "rgba(236,72,153,0.28)");
  orbA.addColorStop(1, "rgba(236,72,153,0)");
  ctx.fillStyle = orbA;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const orbB = ctx.createRadialGradient(980, 260, 40, 980, 260, 380);
  orbB.addColorStop(0, "rgba(168,85,247,0.22)");
  orbB.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = orbB;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const orbC = ctx.createRadialGradient(620, 1240, 40, 620, 1240, 420);
  orbC.addColorStop(0, "rgba(59,130,246,0.18)");
  orbC.addColorStop(1, "rgba(59,130,246,0)");
  ctx.fillStyle = orbC;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const panelX = 96;
  const panelY = 120;
  const panelW = canvas.width - panelX * 2;
  const panelH = canvas.height - 220;

  ctx.save();
  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 42);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const prideColors = ["#fb7185", "#fb923c", "#facc15", "#34d399", "#38bdf8", "#818cf8", "#e879f9"];
  const barGap = 14;
  const barWidth = (panelW - 120 - barGap * (prideColors.length - 1)) / prideColors.length;
  let barX = panelX + 60;

  prideColors.forEach((color) => {
    ctx.fillStyle = color;
    drawRoundedRect(ctx, barX, panelY + 34, barWidth, 10, 5);
    ctx.fill();
    barX += barWidth + barGap;
  });

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 28px ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
  ctx.fillText("Violets & Vibes", panelX + 60, panelY + 104);

  ctx.fillStyle = "#fdf2f8";
  ctx.font = "700 94px ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
  const titleLines = wrapText(ctx, badgeTitle, panelW - 120);
  let currentY = panelY + 250;
  titleLines.forEach((line) => {
    ctx.fillText(line, panelX + 60, currentY);
    currentY += 106;
  });

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "500 44px ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
  wrapText(ctx, badgeSubtitle, panelW - 120).forEach((line) => {
    ctx.fillText(line, panelX + 60, currentY + 24);
    currentY += 58;
  });

  if (profileName) {
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "500 30px ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
    ctx.fillText(`Shared by ${profileName}`, panelX + 60, panelY + panelH - 150);
  }

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "600 32px ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
  ctx.fillText("Women-centered • Safety-first • Identity-Inclusive", panelX + 60, panelY + panelH - 86);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not render badge card"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export async function shareBadgeCard(input: ShareBadgeCardInput) {
  const blob = await createBadgeShareCard(input);
  const fileName = input.badgeTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = new File([blob], `${fileName || "violets-and-vibes-badge"}.png`, {
    type: "image/png",
  });

  const canShareFiles =
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare?.({ files: [file] });

  if (canShareFiles) {
    await navigator.share({
      title: input.badgeTitle,
      text: input.badgeSubtitle,
      files: [file],
    });
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
