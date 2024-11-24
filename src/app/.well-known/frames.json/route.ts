export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  const config = {
    config: {
      version: "0.0.0",
      name: "Frames v2 Demo",
      icon: `${appUrl}/icon.png`,
      splashImage: `${appUrl}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      homeUrl: appUrl,
      fid: 0,
      key: "",
      signature: "",
    },
  };

  return Response.json(config);
}
