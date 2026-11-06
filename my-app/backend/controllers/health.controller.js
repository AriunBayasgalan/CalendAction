export function getHealth(req, res) {
  res.status(200).type("text").send("200 OK");
}
//req is the request coming in res is response back
//res.statis(200) 200 means sucess and status sends JSON message
