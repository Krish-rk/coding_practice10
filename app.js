const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserquery = `
    SELECT * FROM user WHERE 
    username = '${username}';`;
  const dbUser = await db.get(selectUserquery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
let modifyObject = (ele) => {
  return {
    stateId: ele.state_id,
    stateName: ele.state_name,
    population: ele.population,
  };
};

//Get states

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;`;
  const states = await db.all(getStatesQuery);
  let newState = states.map((ele) => {
    return {
      stateId: ele.state_id,
      stateName: ele.state_name,
      population: ele.population,
    };
  });
  console.log(newState);
  response.send(newState);
});

//Get state
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
    SELECT * FROM state
    WHERE
    state_id =${stateId};`;
  const state = await db.get(stateQuery);
  response.send({
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  });
});

//ADD DISTRICT
app.post("/districts/", authenticateToken, async (request, response) => {
  console.log(request.body);
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const createDistrictQuery = `
    INSERT INTO district(district_name,state_id,cases,cured,active,deaths) 
    values(
         '${districtName}',
         ${stateId},
        ${cases},
         ${cured},
         ${active},
        ${deaths});`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//GET DISTRICT
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
    SELECT * FROM district
    WHERE
    district_id =${districtId};`;
    const state = await db.get(districtQuery);

    console.log(state);
    response.send({
      districtName: state.district_id,
      districtName: state.district_name,
      stateId: state.stateId,
      cases: state.cases,
      cured: state.cured,
      active: state.active,
      deaths: state.deaths,
    });
  }
);
//DELETE
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM district WHERE 
    district_id =${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//UPDATE DISTRICT
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const UpdateQuery = `
    UPDATE district 
    SET 
     district_name ='${districtName}',
      state_id =  ${stateId},
      cases=  ${cases},
      cured=   ${cured},
      active=   ${active},
      deaths =  ${deaths};
      WHERE 
      district_id  =${districtId}`;
    await db.run(UpdateQuery);
    response.send("District Details Updated");
  }
);

//Get stats API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
