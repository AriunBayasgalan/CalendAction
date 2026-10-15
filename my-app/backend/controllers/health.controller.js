export function getHealth(req, res) {
  res.status(200).json({ status: "ok" });
}
//req is the request coming in res is response back
//res.statis(200) 200 means sucess and status sends JSON message
