<template>
    <hr>
    <div v-for="(data, client) in convertedData" :key="data.name">
      <div>
        <h2>{{ client }}</h2>
          <table>
            <tr>
              <td>backend</td>
              <td>frontend</td>
              <td>bootstrap</td>
              <td>cloudformation</td>
              <td>keycloak</td>
              <td>superset</td>
            </tr>
            <tr>
              <td>{{ data.backend }}</td>
              <td>{{ data.frontend }}</td>
              <td>{{ data.bootstrap }}</td>
              <td>{{ data.cloudformation }}</td>
              <td>{{ data.keycloak }}</td>
              <td>{{ data.superset }}</td>
            </tr>
          </table>
      </div>
    </div>
</template>

<script>
import data from '!raw-loader!../../public/versions.yml';
import yaml from 'js-yaml';

  export default{
    computed: {
     convertedData: function() {
       let obj = yaml.load(data);
       console.log(obj)
       return obj;
      }
    }
  }
</script>

<style scoped>
table {
  font-family: arial, sans-serif;
  border-collapse: collapse;
  width: 100%;
}

td, th {
  border: 1px solid #dddddd;
  text-align: left;
  padding: 8px;
}

tr:nth-child(odd) {
  background-color: #dddddd;
}

h2 {
  color: #248CD6;
}

hr {
  color: #248CD6;
  background-color: #248CD6;
  box-shadow: 0 0 15px 3px #248CD6;
  border: 0;
  height: 0;
  margin-top: 45px;
  margin-bottom: 45px;
}

</style>
